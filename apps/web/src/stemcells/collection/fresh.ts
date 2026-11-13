// Which feats get a moment: the ones earned while this window was open, the rarest first.
// What the ledger's backfill awards for the past is new on the collection's page, and quiet.

import {
  type Collection,
  type Feat,
  FEATS,
  type FeatState,
  type Rarity,
} from "../../../../../stemcells/ledger/feats.ts";

const RANK: Readonly<Record<Rarity, number>> = { legendary: 0, secret: 1, rare: 2, common: 3 };

export interface Standing {
  readonly feat: Feat;
  readonly state: FeatState;
}

/** Every feat with how it stands, in the catalogue's order. */
export function standings(collection: Collection): Standing[] {
  const states = new Map(collection.feats.map((state) => [state.id, state]));
  return FEATS.flatMap((feat) => {
    const state = states.get(feat.id);
    return state === undefined ? [] : [{ feat, state }];
  });
}

/** The ids of the feats earned. */
export const earnedIds = (collection: Collection): Set<string> =>
  new Set(collection.feats.filter((state) => state.earned !== null).map((state) => state.id));

/**
 * The feats earned now that weren't at `baseline` (the window's first read) and haven't been
 * shown to the person: the rarest first, then in the catalogue's order.
 */
export function freshFeats(baseline: ReadonlySet<string>, collection: Collection): Standing[] {
  const seen = new Set(collection.seen);
  return standings(collection)
    .filter(
      ({ feat, state }) => state.earned !== null && !baseline.has(feat.id) && !seen.has(feat.id),
    )
    .sort((a, b) => RANK[a.feat.rarity] - RANK[b.feat.rarity]);
}

/**
 * The feat a card shows: the one `showing`, for as long as it stands earned (noting it seen
 * never takes its own card down), else the next fresh one the person hasn't `dismissed`.
 */
export function momentOf(
  showing: string | null,
  baseline: ReadonlySet<string>,
  collection: Collection,
  dismissed: ReadonlySet<string>,
): Standing | undefined {
  if (showing === null)
    return freshFeats(baseline, collection).find(({ feat }) => !dismissed.has(feat.id));
  return standings(collection).find(
    ({ feat, state }) => feat.id === showing && state.earned !== null,
  );
}
