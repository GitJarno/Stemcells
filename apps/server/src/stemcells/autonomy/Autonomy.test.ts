import { assert, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import type { Need } from "../needs/derive.ts";
import type { NeedsList } from "../needs/Needs.ts";
import { HEAR_AGAIN_MS, make, WINDOW, type Answer, type AutonomyView } from "./Autonomy.ts";
import type { Kind } from "./kinds.ts";
import * as S from "./standing.ts";

const LATER = "2026-10-24T12:00:00.000Z";
const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));
const window = Duration.toMillis(WINDOW);

const need = (key: string, threadId: string, kind: "failed" | "prose", since = LATER): Need => ({
  key,
  number: 1,
  kind,
  threadId,
  projectId: "project-1",
  parentThreadId: null,
  title: "A Cell",
  providerInstanceId: "claudeAgent",
  since,
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
  /** Cards whose Cell said something final; every other one is reversible. */
  const final = new Set<string>();
  const refused = new Set<string>();
  const autonomy = yield* make(
    {
      lists: Stream.fromQueue(lists),
      answered: (threadId) => Effect.sync(() => answers.get(threadId) ?? null),
      drafts: () => writing,
      reversible: (card) => Effect.sync(() => !final.has(card.key)),
      take: (card, kind) =>
        Effect.gen(function* () {
          const at = yield* Clock.currentTimeMillis;
          yield* Queue.offer(taken, { key: card.key, kind, at });
          return !refused.has(card.key);
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
  const tick = Queue.offer(ticks, undefined);
  /** Past the quiet after the start, with `kind` granted. */
  const granted = (kind: Kind) =>
    Effect.gen(function* () {
      yield* TestClock.adjust(HEAR_AGAIN_MS);
      yield* autonomy.grant(kind);
      yield* Queue.take(saved);
    });
  return {
    autonomy,
    lists,
    tick,
    saved,
    taken,
    answers,
    writing,
    final,
    refused,
    viewWhere,
    granted,
  };
});

const keysTaking = (view: AutonomyView) => view.taking.map((taking) => taking.key);

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

it.effect("a card whose Cell said something final is never taken, nor counted", () =>
  Effect.gen(function* () {
    const w = yield* world;
    w.final.add("final");
    w.answers.set("thread-1", { said: "Try that again." });
    w.answers.set("thread-2", { said: "Try that again." });
    yield* Queue.offer(w.lists, listOf(need("final", "thread-1", "failed")));
    yield* Queue.offer(w.lists, listOf(need("plain", "thread-2", "failed")));
    yield* Queue.offer(w.lists, listOf());
    // Only the reversible card's leaving is counted.
    assert.strictEqual((yield* Queue.take(w.saved)).streaks.retry, 1);
    assert.strictEqual(yield* Queue.size(w.saved), 0);

    yield* w.granted("retry");
    yield* Queue.offer(
      w.lists,
      listOf(need("final", "thread-1", "failed"), need("plain", "thread-2", "failed")),
    );
    assert.deepStrictEqual(keysTaking(yield* w.viewWhere((view) => view.taking.length > 0)), [
      "plain",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("a granted kind's card is taken once its window passes", () =>
  Effect.gen(function* () {
    const w = yield* world;
    yield* w.granted("retry");
    const start = HEAR_AGAIN_MS;
    const first = need("first", "thread-1", "failed");
    const second = need("second", "thread-2", "failed");
    yield* Queue.offer(w.lists, listOf(first));
    yield* w.viewWhere((view) => view.taking.length === 1);

    const half = window / 2;
    yield* TestClock.adjust(half);
    yield* Queue.offer(w.lists, listOf(first, second));
    yield* w.viewWhere((view) => view.taking.length === 2);
    yield* TestClock.adjust(half);
    yield* w.tick;
    assert.deepStrictEqual(yield* Queue.take(w.taken), {
      key: "first",
      kind: "retry",
      at: start + window,
    });
    assert.deepStrictEqual((yield* w.viewWhere((view) => view.took.length === 1)).took, ["first"]);
    yield* TestClock.adjust(half);
    yield* w.tick;
    assert.deepStrictEqual(yield* Queue.take(w.taken), {
      key: "second",
      kind: "retry",
      at: start + window + half,
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

it.effect("a grant takes only the cards that come after it", () =>
  Effect.gen(function* () {
    const w = yield* world;
    yield* w.granted("retry");
    const waiting = need("waiting", "thread-1", "failed", iso(0));
    yield* Queue.offer(w.lists, listOf(waiting, need("new", "thread-2", "failed")));
    assert.deepStrictEqual(keysTaking(yield* w.viewWhere((view) => view.taking.length > 0)), [
      "new",
    ]);
  }).pipe(Effect.scoped),
);

it.effect("after a start or a sleep, no card goes until the screens are heard again", () =>
  Effect.gen(function* () {
    const w = yield* world;
    // Granted at once: the start's quiet still holds the first card back.
    yield* w.autonomy.grant("retry");
    yield* Queue.take(w.saved);
    yield* Queue.offer(w.lists, listOf(need("a", "thread-1", "failed")));
    const started = yield* w.viewWhere((view) => view.taking.length === 1);
    assert.strictEqual(started.taking[0]?.at, iso(HEAR_AGAIN_MS));

    // The Mac sleeps three minutes, past the card's end: at the wake it isn't
    // taken, and its window starts again.
    const woke = 3 * 60_000;
    yield* TestClock.adjust(woke);
    yield* w.tick;
    const after = yield* w.viewWhere((view) => view.taking[0]?.at === iso(woke + HEAR_AGAIN_MS));
    assert.strictEqual(after.taking[0]?.from, iso(woke + HEAR_AGAIN_MS - window));
    assert.strictEqual(yield* Queue.size(w.taken), 0);
  }).pipe(Effect.scoped),
);

it.effect(
  "a card kept with Undo, in a Cell someone is writing to, or refused, stays the person's",
  () =>
    Effect.gen(function* () {
      const w = yield* world;
      yield* w.granted("retry");
      const kept = need("kept", "thread-1", "failed");
      const drafted = need("drafted", "thread-2", "failed");
      const refused = need("refused", "thread-3", "failed");
      w.writing.add("thread-2");
      w.refused.add("refused");
      yield* Queue.offer(w.lists, listOf(kept, drafted, refused));
      yield* w.viewWhere((view) => view.taking.length === 3);

      yield* w.autonomy.keep("kept");
      assert.deepStrictEqual((yield* Queue.take(w.saved)).kept, ["kept"]);
      yield* TestClock.adjust(WINDOW);
      yield* w.tick;
      assert.strictEqual((yield* Queue.take(w.taken)).key, "refused");
      assert.deepStrictEqual((yield* Queue.take(w.saved)).kept, ["kept", "drafted"]);
      assert.deepStrictEqual((yield* Queue.take(w.saved)).kept, ["kept", "drafted", "refused"]);

      // None of them comes back into a window, a draft or not.
      w.writing.clear();
      yield* Queue.offer(
        w.lists,
        listOf(kept, drafted, refused, need("later", "thread-4", "failed")),
      );
      assert.deepStrictEqual(keysTaking(yield* w.viewWhere((view) => view.taking.length > 0)), [
        "later",
      ]);
    }).pipe(Effect.scoped),
);
