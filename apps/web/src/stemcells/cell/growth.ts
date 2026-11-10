// How strong a Cell has grown: from the time it worked alone, summed over
// its chat's landed runs, each less the time it waited on you
// (`stemcells/tasks/cell-growth.md`). Nothing is stored; the thread's records
// say it again whenever they're read.

import type { Strength } from "./kit.ts";

// The count itself is shared with the ledger, which keeps each landed run's.
export { aloneIn, type Span } from "../../../../../stemcells/ledger/alone.ts";

const MINUTE = 60_000;

/** The time worked alone each strength takes, strongest first. */
const GROWN: readonly (readonly [Strength, number])[] = [
  ["biceps", 120 * MINUTE],
  ["arms", 30 * MINUTE],
  ["nubs", 10 * MINUTE],
];

/** A landing whose own run worked alone this long flexes in place of the cheer. */
export const FLEX_MS = 30 * MINUTE;

/** The strength `alone` ms of work grows; undefined below the first. */
export function strengthOf(alone: number): Strength | undefined {
  return GROWN.find(([, after]) => alone >= after)?.[0];
}
