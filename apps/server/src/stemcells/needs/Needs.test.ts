import { assert, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { Changed, InFlight, NeedsSource, RequestDetail, Shell } from "../upstream/needs.ts";
import {
  HOUR,
  MINUTE,
  NOW,
  at,
  pendingRequest,
  runId,
  shellFixture,
  threadId,
} from "../upstream/needs.fixture.ts";
import { make, type NeedsList } from "./Needs.ts";

/** A source over shells the test edits, with the changes it announces. */
const fakeSource = Effect.gen(function* () {
  const shells = new Map<string, Shell>();
  const replies = new Map<string, string>();
  const tools = new Map<string, InFlight["tool"]>();
  const changes = yield* Queue.unbounded<ReadonlyArray<Changed>>();
  const counts = { snapshots: 0, requestReads: 0, replyReads: 0 };
  let failNextRead = false;
  const detail = (id: string): RequestDetail => ({
    id,
    prompt: "pnpm test",
    appName: null,
    reason: null,
    fullAccessOverride: null,
    options: [],
    questions: [],
    responseMode: null,
    capability: "live",
  });
  const source: NeedsSource = {
    ready: Effect.void,
    snapshot: Effect.sync(() => {
      counts.snapshots++;
      return { shells: [...shells.values()], sequence: 0 };
    }),
    changedThreads: () => Stream.fromQueue(changes),
    shell: (threadId) =>
      Effect.suspend(() => {
        if (!failNextRead) return Effect.succeed(shells.get(threadId) ?? null);
        failNextRead = false;
        return Effect.die("the projection is gone");
      }),
    request: (threadId, requestId) =>
      Effect.sync(() => {
        counts.requestReads++;
        const pending = shells.get(threadId)?.pendingRuntimeRequest;
        return pending?.id === requestId ? detail(requestId) : null;
      }),
    plan: () => Effect.succeed(null),
    reply: (threadId) =>
      Effect.sync(() => {
        counts.replyReads++;
        return replies.get(threadId) ?? null;
      }),
    inFlight: (threadId) => Effect.succeed({ tool: tools.get(threadId) ?? null }),
    autoResume: Effect.succeed(false),
  };
  const put = (shell: Shell) => shells.set(shell.id, shell);
  /** The Cells' own work changed these threads. */
  const announce = (...ids: string[]) =>
    Queue.offer(
      changes,
      ids.map((id) => ({ threadId: threadId(id), lively: true })),
    );
  /** The person's hand changed this thread: a visit, a snooze. */
  const touch = (id: string) => Queue.offer(changes, [{ threadId: threadId(id), lively: false }]);
  return {
    source,
    put,
    announce,
    counts,
    replies,
    tools,
    touch,
    failNext: () => (failNextRead = true),
  };
});

const asking = (id: string, ago: number) =>
  shellFixture({ id, pendingRuntimeRequest: pendingRequest("command", { id: `${id}-ask`, ago }) });

const numbered = (list: NeedsList) => list.needs.map((need) => `${need.number} ${need.threadId}`);

/**
 * The first list the service publishes that passes `check`, moving the clock
 * a second at a time meanwhile for the service's own timers.
 */
const listWhere = (changes: Stream.Stream<NeedsList>, check: (list: NeedsList) => boolean) =>
  Effect.raceFirst(
    changes.pipe(Stream.filter(check), Stream.runHead, Effect.map(Option.getOrThrow)),
    Effect.forever(TestClock.adjust("1 second")),
  );

it.effect("publishes the asking Cells, then follows each change without moving a number", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const fake = yield* fakeSource;
      fake.put(asking("floof", 10 * MINUTE));
      fake.put(asking("bongo", 5 * MINUTE));
      fake.put(shellFixture({ id: "pip" }));
      const needs = yield* make(fake.source);

      assert.deepStrictEqual(numbered(yield* needs.list), ["1 floof", "2 bongo"]);
      assert.strictEqual((yield* needs.list).needs[0]?.request?.prompt, "pnpm test");

      fake.put(shellFixture({ id: "floof" }));
      fake.put(asking("pip", MINUTE));
      yield* fake.announce("floof", "pip");
      const after = yield* listWhere(needs.changes, (list) => list.needs[0]?.threadId === "bongo");
      assert.deepStrictEqual(numbered(after), ["2 bongo", "3 pip"]);
      // Bongo's ask was read once, though the list was derived twice.
      assert.strictEqual(fake.counts.requestReads, 3);
    }),
  ),
);

it.effect("starts over from a snapshot after a failed read, keeping the numbers", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const fake = yield* fakeSource;
      fake.put(asking("floof", 10 * MINUTE));
      fake.put(asking("bongo", 5 * MINUTE));
      const needs = yield* make(fake.source);
      yield* needs.list;

      fake.failNext();
      fake.put(shellFixture({ id: "floof" }));
      yield* fake.announce("floof");
      const after = yield* listWhere(needs.changes, (list) => list.needs.length === 1);
      assert.deepStrictEqual(numbered(after), ["2 bongo"]);
      assert.strictEqual(fake.counts.snapshots, 2);
    }),
  ),
);

it.effect("shows a snoozed Cell when its snooze ends, with no event to say so", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const fake = yield* fakeSource;
      fake.put(
        shellFixture({
          id: "otter",
          status: "failed",
          lastErrorClass: "transport_error",
          latestRunCompletedAt: at(-HOUR),
          snoozedAt: at(-30 * MINUTE),
          snoozedUntil: at(30 * MINUTE),
        }),
      );
      const needs = yield* make(fake.source);
      assert.deepStrictEqual(numbered(yield* needs.list), []);

      const woke = yield* listWhere(needs.changes, (list) => list.needs.length === 1);
      assert.deepStrictEqual(numbered(woke), ["1 otter"]);
      assert.strictEqual(woke.needs[0]?.kind, "failed");
    }),
  ),
);

const working = (id: string) =>
  shellFixture({ id, status: "running", activeRunId: runId("run-2"), latestRunId: runId("run-2") });

it.effect(
  "makes a card of a finished reply that asks, and none of a report, which takes no number",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const fake = yield* fakeSource;
        fake.put(shellFixture({ id: "pip" }));
        fake.replies.set("pip", "Fixed the test and pushed. CI is green.");
        fake.put(shellFixture({ id: "floof" }));
        fake.replies.set("floof", "The fix is in.\n\nWant me to push it?");
        fake.put(asking("bongo", MINUTE));
        const needs = yield* make(fake.source);

        const list = yield* needs.list;
        assert.deepStrictEqual(numbered(list), ["1 floof", "2 bongo"]);
        const floof = list.needs.find((need) => need.threadId === "floof");
        assert.deepStrictEqual(floof?.prose, {
          runId: "run-1",
          cue: "offer",
          text: "Want me to push it?",
          steps: [],
          next: null,
          lead: "The fix is in.",
        });

        // Each reply is read once for its run, though the list is derived again.
        yield* fake.announce("bongo");
        yield* listWhere(needs.changes, () => true);
        assert.strictEqual(fake.counts.replyReads, 2);
      }),
    ),
);

it.effect(
  "marks a run quiet past 12 minutes as stuck, and clears it at the next sign of life",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const fake = yield* fakeSource;
        fake.put(working("otter"));
        const needs = yield* make(fake.source);
        assert.deepStrictEqual(numbered(yield* needs.list), []);

        const stuck = yield* listWhere(needs.changes, (list) => list.needs.length === 1);
        assert.strictEqual(stuck.needs[0]?.kind, "stuck");
        assert.deepStrictEqual(stuck.needs[0]?.stuck, {
          runId: "run-2",
          quietSince: "2026-10-21T12:00:00.000Z",
          tool: null,
        });

        // Opening its chat is the person's hand, not the Cell's life: the card stays.
        yield* fake.touch("otter");
        yield* TestClock.adjust("2 minutes");
        assert.deepStrictEqual(numbered(yield* needs.list), ["1 otter"]);

        yield* fake.announce("otter");
        const heard = yield* listWhere(needs.changes, (list) => list.needs.length === 0);
        assert.deepStrictEqual(numbered(heard), []);
      }),
    ),
);

it.effect("gives a run with a tool call in flight 30 minutes before it is stuck", () =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const fake = yield* fakeSource;
      fake.put(working("otter"));
      fake.tools.set("otter", { title: "Run tests", command: "pnpm test:migrate" });
      const needs = yield* make(fake.source);

      const stuck = yield* listWhere(needs.changes, (list) => list.needs.length === 1);
      const quiet = Date.parse(stuck.needs[0]?.since ?? "");
      assert.strictEqual(quiet, NOW);
      assert.isAtLeast((yield* Clock.currentTimeMillis) - NOW, 30 * MINUTE);
      assert.deepStrictEqual(stuck.needs[0]?.stuck?.tool, {
        title: "Run tests",
        command: "pnpm test:migrate",
      });
    }),
  ),
);
