// The phone's arrivals of Aski's planned rows (`stemcells/aski/arrivals.ts`;
// stemcells/tasks/aski-orchestrator.md, decision 12): each lands at the top of the home's Awake
// list as Aski's copy lands there (`copies.ts`) and forms where it landed (`PlannedRows.tsx`).
// Under Reduce Motion it only fades in.

import { useSyncExternalStore } from "react";
import { AccessibilityInfo, type ViewInstance } from "react-native";

import { type Arrival, ARRIVALS, createArrivals } from "../../../../../stemcells/aski/arrivals.ts";
import { plannedRows, subscribePlannedRows } from "../../../../../stemcells/aski/planned.ts";
import { formAt, LEAD } from "../cell/forming";
import { BEAT, clockSeconds, GLYPHS } from "../cell/kit";
import { askiInSight, sendCopy } from "./copies";

export type { Arrival } from "../../../../../stemcells/aski/arrivals.ts";

/** How long a throw waits for its row to be planned, ms: past it, it is forgotten. */
const WAITS = 3000;

let reduced = false;
void AccessibilityInfo.isReduceMotionEnabled().then((on) => (reduced = on));
AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => (reduced = on));

const asked = new Map<string, number>();

/**
 * Aski, where it stands on the home or heading its chat beside it, throws a copy of itself to each
 * of `threadIds`' rows as they arrive in Awake, a stagger apart. Safe before the rows are planned
 * (it waits a few seconds, then gives up quietly), safe to call twice, and nothing under Reduce
 * Motion.
 */
export function throwTo(threadIds: ReadonlyArray<string>): void {
  const now = Date.now();
  for (const [threadId, until] of asked) if (until < now) asked.delete(threadId);
  if (reduced) return;
  for (const threadId of threadIds) asked.set(threadId, now + WAITS);
}

function takeThrow(threadId: string): true | null {
  const until = asked.get(threadId);
  asked.delete(threadId);
  return until !== undefined && until >= Date.now() && askiInSight() ? true : null;
}

let slot: ViewInstance | null = null;

/** Where the next row's Cell lands, while Awake's list is in sight: a ref's view. */
export function slotStandsIn(view: ViewInstance | null): () => void {
  slot = view;
  return () => {
    if (slot === view) slot = null;
  };
}

const arrivals = createArrivals<true, ViewInstance>(plannedRows, {
  now: () => clockSeconds() * 1000,
  reduced: () => reduced,
  travel: () => LEAD * 1000,
  takeThrow,
  slot: () => slot,
  ready: () => undefined,
  playThrow: (_from, to, threadId) =>
    to.measureInWindow((x, y, width, height) => {
      if (width > 0) sendCopy(threadId, { x, y, width, height }, clockSeconds() + LEAD);
    }),
  forms: (threadId, at) => formAt(threadId, at / 1000),
  // From its outline's blocks on: the glyphs are behind it.
  fills: (threadId, at) => formAt(threadId, at / 1000 - GLYPHS.length / BEAT),
  // Its words go, then its title takes their place, before T3's own row stands in for it.
  fade: ARRIVALS.fade + ARRIVALS.fold,
});
subscribePlannedRows(arrivals.sync);

/** The planned rows standing in Awake, in the order they landed. */
export function useArrivals(): readonly Arrival[] {
  return useSyncExternalStore(arrivals.subscribe, arrivals.read, arrivals.read);
}

let held: ReadonlySet<string> = new Set();
let heldFrom: readonly [unknown, unknown] = [null, null];
function heldNow(): ReadonlySet<string> {
  const standing = arrivals.read();
  const coming = arrivals.coming();
  if (heldFrom[0] !== standing || heldFrom[1] !== coming) {
    heldFrom = [standing, coming];
    held = new Set([...coming, ...standing.map((arrival) => arrival.row.threadId)]);
  }
  return held;
}

/** The threads whose planned rows stand, or are on their way: T3's own row for one waits until its birth is over. */
export function useHeldThreads(): ReadonlySet<string> {
  return useSyncExternalStore(arrivals.subscribe, heldNow, heldNow);
}

/** The machine lists these Cells now (`createArrivals`, `listed`). */
export const cellsListed = arrivals.listed;
