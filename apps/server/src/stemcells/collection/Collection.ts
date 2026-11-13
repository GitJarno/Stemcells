import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import type { Fact, LedgerPage } from "../../../../../stemcells/ledger/facts.ts";
import {
  type Collection as CollectionRead,
  type CollectionChange,
  featsOf,
  todayOf,
} from "../../../../../stemcells/ledger/feats.ts";
import { type CellRecords, marksByThread } from "../../../../../stemcells/ledger/marks.ts";
import * as Ledger from "../ledger/Ledger.ts";
import * as Upstream from "../upstream/collection.ts";
import { type Kept, see, tell, wear } from "./kept.ts";

/** The change names a piece no feat earned so far unlocks. */
export class NotUnlockedError extends Schema.TaggedError<NotUnlockedError>()(
  "NotUnlockedError",
  {},
) {
  override get message(): string {
    return "No feat has unlocked that yet.";
  }
}

/**
 * The collection on this machine (`stemcells/tasks/collection.md`): the feats its Cells
 * earned, worked out from the ledger's facts, and what the person keeps beside them.
 */
export class Collection extends Context.Service<
  Collection,
  {
    readonly read: Effect.Effect<CollectionRead, Ledger.LedgerReadError>;
    /** The marks these Cells earned in their own lives (`stemcells/tasks/cell-marks.md`). */
    readonly records: (
      threadIds: ReadonlyArray<string>,
    ) => Effect.Effect<CellRecords, Ledger.LedgerReadError>;
    readonly change: (
      change: CollectionChange,
    ) => Effect.Effect<void, Ledger.LedgerReadError | NotUnlockedError>;
  }
>()("t3/stemcells/collection/Collection") {}

export interface CollectionSource {
  readonly load: Effect.Effect<Kept>;
  readonly save: (kept: Kept) => Effect.Effect<void>;
  readonly page: (query: Ledger.LedgerQuery) => Effect.Effect<LedgerPage, Ledger.LedgerReadError>;
}

/** The facts one read of the ledger takes. */
const PAGE = 2000;

export const make = Effect.fn("Collection.make")(function* (source: CollectionSource) {
  const kept = yield* Ref.make(yield* source.load);
  // A fact is only ever added, so the facts read are held and each read takes only the new.
  const held: Fact[] = [];
  const reading = yield* Semaphore.make(1);
  // One change at a time, each saved before the next: a save never lands over a newer record.
  const changing = yield* Semaphore.make(1);
  let after = 0;
  let backfilled = false;

  const facts = Effect.fn("Collection.facts")(function* () {
    let next: number | null = after;
    while (next !== null) {
      const page: LedgerPage = yield* source.page({ after: next, limit: PAGE, threads: null });
      for (const { key, kind, threadId, at, data } of page.facts)
        held.push({ key, kind, threadId, at, data } as Fact);
      after = page.facts.at(-1)?.seq ?? after;
      backfilled = page.backfilled;
      next = page.next;
    }
    return held;
  }, reading.withPermit);

  const read = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    const all = yield* facts();
    const { worn, seen, deeds } = yield* Ref.get(kept);
    return { feats: featsOf(all, deeds, now), today: todayOf(all, now), worn, seen, backfilled };
  });

  const records = Effect.fn("Collection.records")(function* (threadIds: ReadonlyArray<string>) {
    const asked = new Set(threadIds);
    const theirs = (yield* facts()).filter((fact) => asked.has(fact.threadId));
    return { marks: Object.fromEntries(marksByThread(theirs)) } satisfies CellRecords;
  });

  const change = Effect.fn("Collection.change")(function* (asked: CollectionChange) {
    const now = yield* Clock.currentTimeMillis;
    const before = yield* Ref.get(kept);
    let next: Kept | null;
    if ("wear" in asked) {
      const { feats } = yield* read;
      next = wear(before, feats, asked.wear.threadId, asked.wear.worn);
    } else if ("seen" in asked) next = see(before, asked.seen);
    else {
      next = tell(before, asked.deed.deed, {
        at: DateTime.formatIso(DateTime.makeUnsafe(now)),
        threadId: asked.deed.threadId,
      });
    }
    if (next === null) return yield* new NotUnlockedError();
    if (next === before) return;
    yield* Ref.set(kept, next);
    yield* source.save(next);
  }, changing.withPermit);

  return Collection.of({ read, records, change });
});

export const layer = Layer.effect(
  Collection,
  Effect.gen(function* () {
    const ledger = yield* Ledger.Ledger;
    return yield* make({ ...(yield* Upstream.makeCollectionFile), page: ledger.page });
  }),
).pipe(Layer.provide(Ledger.layer));
