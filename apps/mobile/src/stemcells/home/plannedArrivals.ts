// The phone's arrivals of Aski's planned rows (`stemcells/aski/arrivals.ts`;
// stemcells/tasks/aski-orchestrator.md, decision 12): each lands at the top of the home's Awake
// list as Aski's copy lands there (`copies.ts`) and forms where it landed (`PlannedRows.tsx`).
// Under Reduce Motion it only fades in.

import { useSyncExternalStore } from "react";
import { AccessibilityInfo, AppState, type ViewInstance } from "react-native";

import { type Arrival, ARRIVALS, createArrivals } from "../../../../../stemcells/aski/arrivals.ts";
import {
  type Planned,
  plannedRows,
  subscribePlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
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
  // Its words go, then its title takes their place, before its birth is over.
  fade: ARRIVALS.fade + ARRIVALS.fold,
});
subscribePlannedRows(arrivals.sync);

/**
 * Rows whose birth is over, in the order it ended. T3's list puts a new row in a few frames after
 * it is handed one, so a row that left here in sight would blink; it keeps its place until Awake
 * is out of sight (`releaseKept`), and T3's own row stands in for it from then.
 */
const kept = new Map<string, Planned>();
let keptShown: readonly Planned[] = [];
let before: readonly Arrival[] = [];
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};
arrivals.subscribe(() => {
  const now = arrivals.read();
  const standing = new Set(now.map((arrival) => arrival.row.threadId));
  for (const arrival of before) {
    const { threadId } = arrival.row;
    if (arrival.state !== "fading" || standing.has(threadId)) continue;
    kept.set(threadId, arrival.row);
    keptShown = [...kept.values()];
  }
  before = now;
  tell();
});
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Awake is out of sight, or these Cells left it: T3's own rows stand in for the kept ones (all of them, unnamed). */
export function releaseKept(threadIds?: ReadonlyArray<string>): void {
  if (kept.size === 0) return;
  for (const threadId of threadIds ?? [...kept.keys()]) kept.delete(threadId);
  if (kept.size === keptShown.length) return;
  keptShown = [...kept.values()];
  tell();
}
AppState.addEventListener("change", (state) => {
  if (state !== "active") releaseKept();
});

/** The planned rows standing in Awake, in the order they landed. */
export function useArrivals(): readonly Arrival[] {
  return useSyncExternalStore(subscribe, arrivals.read, arrivals.read);
}

/** The rows whose birth is over, standing until Awake is out of sight. */
export function useKept(): readonly Planned[] {
  return useSyncExternalStore(
    subscribe,
    () => keptShown,
    () => keptShown,
  );
}

let held: ReadonlySet<string> = new Set();
let heldFrom: readonly [unknown, unknown, unknown] = [null, null, null];
function heldNow(): ReadonlySet<string> {
  const standing = arrivals.read();
  const coming = arrivals.coming();
  if (heldFrom[0] !== standing || heldFrom[1] !== coming || heldFrom[2] !== keptShown) {
    heldFrom = [standing, coming, keptShown];
    held = new Set([...coming, ...standing.map((arrival) => arrival.row.threadId), ...kept.keys()]);
  }
  return held;
}

/** The threads whose planned rows stand, or are on their way: T3's own row for one waits until it is handed over. */
export function useHeldThreads(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, heldNow, heldNow);
}

/** The machine lists these Cells now (`createArrivals`, `listed`). */
export const cellsListed = arrivals.listed;
