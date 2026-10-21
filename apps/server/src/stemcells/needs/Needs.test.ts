import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { NeedsSource, RequestDetail, Shell, ShellThreadId } from "../upstream/needs.ts";
import {
  HOUR,
  MINUTE,
  NOW,
  at,
  pendingRequest,
  shellFixture,
  threadId,
} from "../upstream/needs.fixture.ts";
import { make, type NeedsList } from "./Needs.ts";

/** A source over shells the test edits, with the changes it announces. */
const fakeSource = Effect.gen(function* () {
  const shells = new Map<string, Shell>();
  const changes = yield* Queue.unbounded<ReadonlyArray<ShellThreadId>>();
  const counts = { snapshots: 0, requestReads: 0 };
  let failNextRead = false;
  const detail = (id: string): RequestDetail => ({
    id,
    prompt: "pnpm test",
    appName: null,
    options: [],
    questions: [],
    responseMode: null,
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
  };
  const put = (shell: Shell) => shells.set(shell.id, shell);
  const announce = (...ids: string[]) => Queue.offer(changes, ids.map(threadId));
  return { source, put, announce, counts, failNext: () => (failNextRead = true) };
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
