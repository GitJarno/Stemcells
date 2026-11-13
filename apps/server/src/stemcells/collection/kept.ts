// What the person keeps beside the feats (`stemcells/tasks/collection.md`): what each Cell wears
// by their choice, the feats they have been shown, and the deeds a screen told of. The feats
// themselves are never kept: they are worked out from the ledger's facts when asked.

import * as Schema from "effect/Schema";

import {
  type Deed,
  type DeedTold,
  FEATS,
  type FeatState,
  unlockedPieces,
} from "../../../../../stemcells/ledger/feats.ts";

const Told = Schema.Struct({ at: Schema.String, threadId: Schema.NullOr(Schema.String) });

export const Kept = Schema.Struct({
  worn: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  seen: Schema.Array(Schema.String),
  deeds: Schema.Struct({
    dazed: Schema.optionalKey(Told),
    tossed: Schema.optionalKey(Told),
    stroked: Schema.optionalKey(Told),
  }),
});
export type Kept = typeof Kept.Type;

export const EMPTY: Kept = { worn: {}, seen: [], deeds: {} };

/** A Cell wears at most this many chosen things: one a slot. */
export const MOST_WORN = 4;

const KNOWN = new Set(FEATS.map((feat) => feat.id));

/**
 * Dresses the Cell `threadId` in `worn`, or gives it back its own look (none). Null when a
 * piece isn't one the feats earned so far unlock: the wardrobe holds only what was earned.
 */
export function wear(
  kept: Kept,
  feats: ReadonlyArray<FeatState>,
  threadId: string,
  worn: ReadonlyArray<string>,
): Kept | null {
  const unlocked = unlockedPieces(feats);
  const chosen = [...new Set(worn)];
  if (chosen.length > MOST_WORN || chosen.some((id) => !unlocked.has(id))) return null;
  const { [threadId]: _before, ...others } = kept.worn;
  return { ...kept, worn: chosen.length === 0 ? others : { ...others, [threadId]: chosen } };
}

/** Notes that these feats have been shown; ids no feat has are dropped. The same record when nothing is new. */
export function see(kept: Kept, ids: ReadonlyArray<string>): Kept {
  const fresh = [...new Set(ids)].filter((id) => KNOWN.has(id) && !kept.seen.includes(id));
  return fresh.length === 0 ? kept : { ...kept, seen: [...kept.seen, ...fresh] };
}

/** Keeps a deed the first time it is told: the first telling stands. */
export function tell(kept: Kept, deed: Deed, told: DeedTold): Kept {
  return kept.deeds[deed] === undefined
    ? { ...kept, deeds: { ...kept.deeds, [deed]: told } }
    : kept;
}
