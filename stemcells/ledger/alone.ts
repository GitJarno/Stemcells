// The time a Cell worked alone in a run that landed: the run's length less the time it waited
// on the person. One count for the Cell's growth (`apps/web/src/stemcells/cell/growth.ts`) and
// the ledger's `landed` fact, so both say the same of a run.

/** A stretch of time, in ms since the epoch. */
export interface Span {
  readonly from: number;
  readonly to: number;
}

/** A run that landed: when it started and landed, and when it waited on you. */
export interface LandedRun extends Span {
  readonly waits: readonly Span[];
}

/** How long `run` worked alone: its length less its waits, each clipped to it, overlaps counted once. */
export function aloneIn(run: LandedRun): number {
  let waited = 0;
  let reached = run.from;
  // `sort` on a copy, not `toSorted`: the phone's Hermes lacks it.
  for (const wait of [...run.waits].sort((a, b) => a.from - b.from)) {
    const from = Math.max(wait.from, reached);
    const to = Math.min(wait.to, run.to);
    if (to > from) waited += to - from;
    reached = Math.max(reached, to);
  }
  return Math.max(0, run.to - run.from - waited);
}
