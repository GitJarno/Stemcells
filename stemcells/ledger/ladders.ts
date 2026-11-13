// The feats as the collection shows them: each measure's feats one ladder climbed rung by rung,
// the ladders in three segments, the secrets apart and in no count, and one rank over all of
// it (`stemcells/tasks/collection.md`). Pure, and safe for the phone's Hermes.

import { type Feat, FEATS, type FeatState, type Measure, type Segment, SEGMENTS } from "./feats.ts";

/** A feat with how it stands. */
export interface Standing {
  readonly feat: Feat;
  readonly state: FeatState;
}

/** Every feat with how it stands, in the catalogue's order. */
export function standingsOf(feats: ReadonlyArray<FeatState>): Standing[] {
  const states = new Map(feats.map((state) => [state.id, state]));
  return FEATS.flatMap((feat) => {
    const state = states.get(feat.id);
    return state === undefined ? [] : [{ feat, state }];
  });
}

/** One measure's feats, the lowest first: a ladder of one rung for a feat that stands alone. */
export interface Ladder {
  readonly measure: Measure;
  readonly segment: Segment;
  readonly rungs: ReadonlyArray<Standing>;
  /** How many rungs are earned. */
  readonly earned: number;
  /** The rung being climbed; null once the ladder is topped. */
  readonly next: Standing | null;
  /** How far the measure has come. */
  readonly have: number;
}

/** The ladders, in the catalogue's order; a secret feat is on none. */
export function laddersOf(feats: ReadonlyArray<FeatState>): Ladder[] {
  const byMeasure = new Map<Measure, Standing[]>();
  for (const standing of standingsOf(feats)) {
    if (standing.feat.segment === null) continue;
    const rungs = byMeasure.get(standing.feat.measure);
    if (rungs === undefined) byMeasure.set(standing.feat.measure, [standing]);
    else rungs.push(standing);
  }
  return [...byMeasure].map(([measure, rungs]) => ({
    measure,
    segment: rungs[0]!.feat.segment!,
    rungs,
    earned: rungs.filter(({ state }) => state.earned !== null).length,
    next: rungs.find(({ state }) => state.earned === null) ?? null,
    have: Math.max(...rungs.map(({ state }) => state.have)),
  }));
}

/** The secret feats: shown as nothing until earned, and counted in no total. */
export const secretsOf = (feats: ReadonlyArray<FeatState>): Standing[] =>
  standingsOf(feats).filter(({ feat }) => feat.segment === null);

/** How far along `ladder` is to its next rung, 0 to 1; 1 once topped. */
export const reachOf = (ladder: Ladder): number =>
  ladder.next === null ? 1 : Math.min(1, ladder.have / ladder.next.feat.of);

/** A ladder time climbs on its own is no goal to work at: it is never next up. */
const CLIMBS_ALONE: ReadonlySet<Measure> = new Set<Measure>(["days"]);

/**
 * The rungs nearest earned, the nearest first, `most` at most: what the collection puts in
 * front of the person. A ladder not yet started isn't near.
 */
export function nextUp(ladders: ReadonlyArray<Ladder>, most = 3): Ladder[] {
  return ladders
    .filter(
      (ladder) => ladder.next !== null && ladder.have > 0 && !CLIMBS_ALONE.has(ladder.measure),
    )
    .map((ladder, order) => ({ ladder, order, reach: reachOf(ladder) }))
    .sort((a, b) => b.reach - a.reach || a.order - b.order)
    .slice(0, most)
    .map(({ ladder }) => ladder);
}

export interface Count {
  readonly earned: number;
  readonly of: number;
}

/** The feats earned of all that count, each segment's, and the secrets found. */
export interface Tally {
  readonly all: Count;
  readonly segments: ReadonlyArray<Count & { readonly segment: Segment }>;
  readonly secrets: number;
}

export function tallyOf(feats: ReadonlyArray<FeatState>): Tally {
  const ladders = laddersOf(feats);
  const count = (of: ReadonlyArray<Ladder>): Count => ({
    earned: of.reduce((sum, ladder) => sum + ladder.earned, 0),
    of: of.reduce((sum, ladder) => sum + ladder.rungs.length, 0),
  });
  return {
    all: count(ladders),
    segments: SEGMENTS.map((segment) => ({
      segment,
      ...count(ladders.filter((ladder) => ladder.segment === segment)),
    })),
    secrets: secretsOf(feats).filter(({ state }) => state.earned !== null).length,
  };
}

/**
 * The feats a rank takes, the first rank at none. The last is short of every feat: no one
 * rung, the top of the longest ladder least of all, stands between the person and it.
 */
export const RANKS: ReadonlyArray<number> = [0, 3, 8, 15, 22, 29, 35];

/** The rank `earned` feats make (an index into `RANKS`), and how many more the next takes; null at the last. */
export function rankOf(earned: number): { readonly rank: number; readonly toNext: number | null } {
  let rank = 0;
  for (let n = 0; n < RANKS.length; n += 1) if (earned >= RANKS[n]!) rank = n;
  const next = RANKS[rank + 1];
  return { rank, toNext: next === undefined ? null : next - earned };
}

/** The feats earned last, the newest first, `most` at most. */
export function latestOf(feats: ReadonlyArray<FeatState>, most = 3): Standing[] {
  return standingsOf(feats)
    .filter(({ state }) => state.earned !== null)
    .map((standing, order) => ({ standing, order, at: Date.parse(standing.state.earned!.at) }))
    .sort((a, b) => b.at - a.at || b.order - a.order)
    .slice(0, most)
    .map(({ standing }) => standing);
}
