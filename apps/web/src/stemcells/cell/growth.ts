// How strong a Cell has grown: from the time it worked alone, summed over
// its chat's landed runs, each less the time it waited on you
// (`stemcells/tasks/cell-growth.md`). Nothing is stored; the thread's records
// say it again whenever they're read.

import type { Strength } from "./kit.ts";

import { GROWN_MS } from "../../../../../stemcells/ledger/alone.ts";

// The count and its stages are shared with the ledger, which keeps each landed run's, and
// with the marks a Cell earns by them.
export { aloneIn, type Span } from "../../../../../stemcells/ledger/alone.ts";

const MINUTE = 60_000;

/** The time worked alone each strength takes, strongest first. */
const GROWN: readonly (readonly [Strength, number])[] = [
  ["biceps", GROWN_MS.biceps],
  ["arms", GROWN_MS.arms],
  ["nubs", GROWN_MS.nubs],
];

/** A landing whose own run worked alone this long flexes in place of the cheer. */
export const FLEX_MS = 30 * MINUTE;

/** The strength `alone` ms of work grows; undefined below the first. */
export function strengthOf(alone: number): Strength | undefined {
  return GROWN.find(([, after]) => alone >= after)?.[0];
}
