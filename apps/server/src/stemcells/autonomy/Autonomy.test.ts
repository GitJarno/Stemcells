import { assert, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { Need } from "../needs/derive.ts";
import type { NeedsList } from "../needs/Needs.ts";
import { make, WINDOW, type Answer, type AutonomyView } from "./Autonomy.ts";
import type { Kind } from "./kinds.ts";
import * as S from "./standing.ts";

const need = (key: string, threadId: string, kind: "failed" | "prose"): Need => ({
  key,
  number: 1,
  kind,
  threadId,
  projectId: "project-1",
  parentThreadId: null,
  title: "A Cell",
  providerInstanceId: "claudeAgent",
  since: "2026-10-24T12:00:00.000Z",
  blocks: false,
  request: null,
  plan: null,
  limit: null,
  failure:
    kind === "failed" ? { runId: "run-1", errorClass: "transport_error", message: null } : null,
  prose:
    kind === "prose" ? { runId: "run-1", cue: "stopped", text: "Next, I'll add the tests." } : null,
  stuck: null,
});

const listOf = (...needs: ReadonlyArray<Need>): NeedsList => ({ needs, cells: [] });

const world = Effect.gen(function* () {
  const lists = yield* Queue.unbounded<NeedsList>();
  const ticks = yield* Queue.unbounded<void>();
  const saved = yield* Queue.unbounded<S.Standing>();
  const taken = yield* Queue.unbounded<{ key: string; kind: Kind; at: number }>();
  const answers = new Map<string, Answer>();
  const writing = new Set<string>();
  const autonomy = yield* make(
    {
      lists: Stream.fromQueue(lists),
      answered: (threadId) => Effect.sync(() => answers.get(threadId) ?? null),
      drafts: () => writing,
      take: (taking, kind) =>
        Effect.gen(function* () {
          const at = yield* Clock.currentTimeMillis;
          yield* Queue.offer(taken, { key: taking.key, kind, at });
          return true;
        }),
      load: Effect.succeed(S.INITIAL),
      save: (standing) => Queue.offer(saved, standing).pipe(Effect.asVoid),
    },
    Stream.fromQueue(ticks),
  );
  /** The view once it satisfies `test`. */
  const viewWhere = (test: (view: AutonomyView) => boolean) =>
    Stream.runHead(Stream.filter(autonomy.changes, test)).pipe(
      Effect.map((view) => view.pipe(Option.getOrThrow)),
    );
  return { autonomy, lists, ticks, saved, taken, answers, writing, viewWhere };
});

it.effect("five takes in a row make the offer, and anything else starts the count again", () =>
  Effect.gen(function* () {
    const w = yield* world;
    const leaves = (key: string, said: string) =>
      Effect.gen(function* () {
        w.answers.set(`thread-${key}`, { said });
        yield* Queue.offer(w.lists, listOf(need(key, `thread-${key}`, "prose")));
        yield* Queue.offer(w.lists, listOf());
        return (yield* Queue.take(w.saved)).streaks.goAhead;
      });

    assert.strictEqual(yield* leaves("a", "Go ahead."), 1);
    assert.strictEqual(yield* leaves("b", "No, wait for the review first."), 0);
    for (const [index, key] of ["c", "d", "e", "f", "g"].entries()) {
      assert.strictEqual(yield* leaves(key, "Go ahead."), index + 1);
    }
    const view = yield* w.viewWhere((candidate) => candidate.offers.length > 0);
    assert.deepStrictEqual(view.offers, ["goAhead"]);

    // "Not now": never offered again.
    yield* w.autonomy.decline("goAhead");
    assert.deepStrictEqual((yield* Queue.take(w.saved)).declined, ["goAhead"]);
    assert.deepStrictEqual((yield* w.autonomy.view).offers, []);
  }).pipe(Effect.scoped),
);

it.effect("a granted kind's card is taken once its window passes", () =>
  Effect.gen(function* () {
    const w = yield* world;
    yield* w.autonomy.grant("retry");
    yield* Queue.take(w.saved);
    const first = need("first", "thread-1", "failed");
    const second = need("second", "thread-2", "failed");
    yield* Queue.offer(w.lists, listOf(first));
    yield* w.viewWhere((view) => view.taking.length === 1);

    const half = Duration.toMillis(WINDOW) / 2;
    yield* TestClock.adjust(half);
    yield* Queue.offer(w.lists, listOf(first, second));
    yield* w.viewWhere((view) => view.taking.length === 2);
    yield* TestClock.adjust(half);
    yield* Queue.offer(w.ticks, undefined);
    assert.deepStrictEqual(yield* Queue.take(w.taken), {
      key: "first",
      kind: "retry",
      at: Duration.toMillis(WINDOW),
    });
    yield* TestClock.adjust(half);
    yield* Queue.offer(w.ticks, undefined);
    assert.deepStrictEqual(yield* Queue.take(w.taken), {
      key: "second",
      kind: "retry",
      at: Duration.toMillis(WINDOW) + half,
    });

    // Aski's takes leaving are no takes of the person's: the next card counts as the first.
    for (const id of ["thread-1", "thread-2", "thread-3"]) {
      w.answers.set(id, { said: "Try that again." });
    }
    yield* Queue.offer(w.lists, listOf());
    yield* Queue.offer(w.lists, listOf(need("third", "thread-3", "failed")));
    yield* Queue.offer(w.lists, listOf());
    assert.strictEqual((yield* Queue.take(w.saved)).streaks.retry, 1);
    assert.strictEqual(yield* Queue.size(w.saved), 0);
  }).pipe(Effect.scoped),
);

it.effect("a card kept with Undo, or in a Cell someone is writing to, stays the person's", () =>
  Effect.gen(function* () {
    const w = yield* world;
    yield* w.autonomy.grant("retry");
    yield* Queue.take(w.saved);
    const kept = need("kept", "thread-1", "failed");
    const drafted = need("drafted", "thread-2", "failed");
    const taken = need("taken", "thread-3", "failed");
    w.writing.add("thread-2");
    yield* Queue.offer(w.lists, listOf(kept, drafted, taken));
    yield* w.viewWhere((view) => view.taking.length === 3);

    yield* w.autonomy.keep("kept");
    assert.deepStrictEqual((yield* Queue.take(w.saved)).kept, ["kept"]);
    yield* TestClock.adjust(WINDOW);
    yield* Queue.offer(w.ticks, undefined);
    assert.strictEqual((yield* Queue.take(w.taken)).key, "taken");
    assert.deepStrictEqual((yield* Queue.take(w.saved)).kept, ["kept", "drafted"]);

    // Kept cards never come back into a window, a draft or not.
    w.writing.clear();
    yield* Queue.offer(w.lists, listOf(kept, drafted, need("later", "thread-4", "failed")));
    const view = yield* w.viewWhere((candidate) => candidate.taking.length > 0);
    assert.deepStrictEqual(
      view.taking.map((taking) => taking.key),
      ["later"],
    );
  }).pipe(Effect.scoped),
);
