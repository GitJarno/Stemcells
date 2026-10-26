import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

import type { Need } from "../needs/derive.ts";
import type { NeedsList } from "../needs/Needs.ts";
import { make } from "./Asks.ts";
import { EMPTY, type Ledger } from "./ledger.ts";

const need = (key: string, kind: Need["kind"]): Need => ({
  key,
  number: 1,
  kind,
  threadId: `thread-${key}`,
  projectId: "project-1",
  parentThreadId: null,
  title: "A Cell",
  providerInstanceId: "codex",
  since: "2026-10-27T09:00:00.000Z",
  blocks: true,
  request: null,
  plan: null,
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
});

const listOf = (...needs: ReadonlyArray<Need>): NeedsList => ({ needs, cells: [] });

const world = Effect.gen(function* () {
  const lists = yield* Queue.unbounded<NeedsList>();
  const saved = yield* Queue.unbounded<Ledger>();
  const asks = yield* make({
    lists: Stream.fromQueue(lists),
    load: Effect.succeed(EMPTY),
    save: (ledger) => Queue.offer(saved, ledger).pipe(Effect.asVoid),
  });
  /** The list changes, and the ledger is saved with it. */
  const list = (...needs: ReadonlyArray<Need>) =>
    Queue.offer(lists, listOf(...needs)).pipe(Effect.andThen(Queue.take(saved)));
  return { asks, list, saved };
});

it.effect("follows the list on this Mac, and measures how each kind's asks ended", () =>
  Effect.gen(function* () {
    const w = yield* world;
    yield* w.list(need("a", "question"), need("b", "question"), need("c", "permission"));
    yield* w.asks.mark("a", "answered", null, null);
    yield* Queue.take(w.saved);
    yield* w.asks.mark("b", "flagged", "Which copy is the old one", null);
    const flagged = yield* Queue.take(w.saved);
    assert.deepStrictEqual(flagged.asks["b"]?.flag?.note, "Which copy is the old one");

    // All three leave the list: one answered from the ask, one flagged, one taken care of elsewhere.
    yield* w.list();
    assert.deepStrictEqual((yield* w.asks.measure).kinds, [
      { kind: "question", ended: 2, alone: 1, flagged: 1, whole: false },
      { kind: "permission", ended: 1, alone: 0, flagged: 0, whole: false },
    ]);
  }).pipe(Effect.scoped),
);
