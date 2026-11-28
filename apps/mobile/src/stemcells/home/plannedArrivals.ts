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
import { clockSeconds } from "../cell/kit";
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
  // Its words go, then its title takes their place, before its birth is over.
  fade: ARRIVALS.fade + ARRIVALS.fold,
});
subscribePlannedRows(arrivals.sync);

/**
 * Rows whose birth is over, in the order it ended. T3's list puts a new row in a few frames after
 * it is handed one, so a row that left here in sight would blink. In sight it is handed over
 * under a copy of itself (`handOver`); out of sight T3's own row just stands in (`releaseKept`).
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

/** Where a row stood in Awake's list, within the layer its copy is drawn on (`PlannedRows.tsx`). */
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A kept row on its way to T3's list in sight: a copy stands where it stood while T3's row comes in under it. */
export interface Handed {
  readonly row: Planned;
  readonly frame: Frame;
  /** The room it took in the list with its gap, points: held open until T3's row has taken it. */
  readonly room: number;
  /** T3's row is in the list, and the room is given back. */
  readonly landed: boolean;
}

const handed = new Map<string, Handed>();
let handedShown: readonly Handed[] = [];
/** How long a copy stands once T3's row is in the list under it, ms: the frames the list takes to draw it. */
const COPY_STANDS = 120;
/** How long a copy waits for T3's row before it goes anyway, ms: the list never draws a row that left Awake, or stands far down it. */
const COPY_WAITS = 1500;
const leaves = new Map<string, ReturnType<typeof setTimeout>>();
let tellHanding: (on: boolean) => void = () => undefined;

/** Told as a row starts changing hands with none before it, and as the last one is done: the list's rows stand still between (`threadListAnimations.ts`). */
export function onHanding(listener: (on: boolean) => void): void {
  tellHanding = listener;
}

function leaveIn(threadId: string, ms: number): void {
  clearTimeout(leaves.get(threadId));
  leaves.set(
    threadId,
    setTimeout(() => handedOver(threadId), ms),
  );
}

/**
 * Hands a kept row to T3's list while Awake is watched: T3's own row, with its swipe and its
 * menu, is let into the list, and a copy of ours covers the frames T3's list takes to draw it.
 */
export function handOver(threadId: string, frame: Frame, room: number): void {
  const row = kept.get(threadId);
  if (row === undefined) return;
  if (handed.size === 0) tellHanding(true);
  kept.delete(threadId);
  keptShown = [...kept.values()];
  handed.set(threadId, { row, frame, room, landed: false });
  handedShown = [...handed.values()];
  leaveIn(threadId, COPY_WAITS);
  tell();
}

/** T3's row is in the list, a row lower than it will stand: the room ours left is given back in the same draw. */
export function handedLanded(threadId: string): void {
  const one = handed.get(threadId);
  if (one === undefined || one.landed) return;
  handed.set(threadId, { ...one, landed: true });
  handedShown = [...handed.values()];
  leaveIn(threadId, COPY_STANDS);
  tell();
}

/** T3's row stands where the copy did: the copy goes. */
export function handedOver(threadId: string): void {
  clearTimeout(leaves.get(threadId));
  leaves.delete(threadId);
  if (!handed.delete(threadId)) return;
  handedShown = [...handed.values()];
  if (handed.size === 0) tellHanding(false);
  tell();
}

/** The rows being handed to T3's list, oldest first. */
export function useHanded(): readonly Handed[] {
  return useSyncExternalStore(
    subscribe,
    () => handedShown,
    () => handedShown,
  );
}

/** Whether a copy still stands over this Cell's row in T3's list: the row draws nothing until it goes. */
export function useIsHanded(threadId: string): boolean {
  const read = () => handed.has(threadId);
  return useSyncExternalStore(subscribe, read, read);
}

/** Awake is out of sight, or these Cells left it: T3's own rows stand in for the kept ones (all of them, unnamed). */
export function releaseKept(threadIds?: ReadonlyArray<string>): void {
  if (kept.size === 0) return;
  for (const threadId of threadIds ?? [...kept.keys()]) kept.delete(threadId);
  if (kept.size === keptShown.length) return;
  keptShown = [...kept.values()];
  tell();
}
AppState.addEventListener("change", (state) => {
  if (state === "active") return;
  releaseKept();
  for (const threadId of handed.keys()) handedOver(threadId);
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
