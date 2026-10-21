// How strong a Cell has grown: from the time it worked alone, summed over
// its chat's landed runs, each less the time it waited on you
// (`stemcells/tasks/cell-growth.md`). Nothing is stored; the thread's records
// say it again whenever they're read.

import type { Strength } from "./kit.ts";

const MINUTE = 60_000;

/** The time worked alone each strength takes, strongest first. */
const GROWN: readonly (readonly [Strength, number])[] = [
  ["biceps", 120 * MINUTE],
  ["arms", 30 * MINUTE],
  ["nubs", 10 * MINUTE],
];

/** A landing whose own run worked alone this long flexes in place of the cheer. */
export const FLEX_MS = 30 * MINUTE;

/** A stretch of time, in ms since the epoch. */
export interface Span {
  readonly from: number;
  readonly to: number;
}

/** A run that landed: when it started and landed, and when it waited on you. */
export interface LandedRun extends Span {
  readonly waits: readonly Span[];
}

/** The strength `alone` ms of work grows; undefined below the first. */
export function strengthOf(alone: number): Strength | undefined {
  return GROWN.find(([, after]) => alone >= after)?.[0];
}

/** How long `run` worked alone: its length less its waits, each clipped to it, overlaps counted once. */
export function aloneIn(run: LandedRun): number {
  let waited = 0;
  let reached = run.from;
  for (const wait of run.waits.toSorted((a, b) => a.from - b.from)) {
    const from = Math.max(wait.from, reached);
    const to = Math.min(wait.to, run.to);
    if (to > from) waited += to - from;
    reached = Math.max(reached, to);
  }
  return Math.max(0, run.to - run.from - waited);
}
