// What the phone's list can't do of the lists' one motion (`listMotion.ts`): a slept or woken
// row's Cell flies to its new stage's count as T3's dismissal starts, at once when the move says
// where (`toward`), else once the line does (fading if it went nowhere); and a row new to a stage
// enters there the first time it's seen (`Arrival.tsx`).

import { useSyncExternalStore } from "react";
import type { View } from "react-native";
import type { AnimatedRef } from "react-native-reanimated";

import type { EnvironmentThreadShell } from "../upstream/cells";
import { withThreadDismissal } from "../upstream/dismissal";
import type { Box } from "./copies";
import { segmentOf } from "./flight";
import { LIST_MOTION, type LineStage } from "../line/kit";

export type HopStage = "awake" | "asleep";

interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

/** Long enough for the row to slide away and the move to show on the line; past it, nothing moved. */
const WAIT_MS = 1500;
/** The pill says where it stands within a frame or two; past this, the Cell lands where it is. */
const PILL_MS = 500;
/** An entrance not seen in this long is forgotten. */
const ARRIVAL_MS = 10 * 60_000;
/** A swipe's throw stands for its Cell's departure this long after the finger lifts. */
const THROW_MS = 600;

export interface Hop {
  readonly key: string;
  /** This departure's own: a Cell woken mid-leap starts a new flight, not the old one's end. */
  readonly id: number;
  readonly thread: EnvironmentThreadShell;
  readonly from: Box;
  readonly fromStage: HopStage;
  /** Where the move took it, once the line says; its count holds it until it lands. */
  readonly toStage: HopStage | null;
  /** Its stage's segment, once measured: it flies. */
  readonly to: Box | null;
  /** It went nowhere: it fades where it waits. */
  readonly fades: boolean;
  /** How fast across (pt/s) the swipe that let it go threw its row; 0 when not thrown. */
  readonly thrown: number;
  /** It has touched down in its count, which counts it now, and is sinking into it. */
  readonly caught: boolean;
  /** Its place in its row, which a swipe may still be carrying, read again as it takes off. */
  readonly track: AnimatedRef<View> | null;
}

interface Departure {
  readonly fromStage: HopStage;
}

const departures = new Map<string, Departure>();
/** The stage a move the person chose takes its Cell to, while T3 starts the row's dismissal. */
const heading = new Map<string, HopStage>();
const STAGE_OF: Readonly<Record<string, HopStage>> = {
  settle: "asleep",
  snooze: "asleep",
  unsettle: "awake",
  unsnooze: "awake",
};
const hops = new Map<string, Hop>();
const throws = new Map<string, { readonly speed: number; readonly at: number }>();
const arrivals = new Map<string, { readonly stage: LineStage; readonly at: number }>();
let pill: { readonly view: Measurable; readonly stages: readonly string[] } | null = null;
let shown: readonly Hop[] = [];
let bump: { readonly stage: HopStage; readonly count: number } | null = null;
const listeners = new Set<() => void>();
let departed = 0;

function changed(): void {
  shown = [...hops.values()];
  for (const listener of listeners) listener();
}

const other = (stage: HopStage): HopStage => (stage === "awake" ? "asleep" : "awake");

/** Where the stages' pill stands, and its segments' stages in order. */
export function pillStandsIn(view: Measurable | null, stages: readonly string[]): () => void {
  const standing = view === null ? null : { view, stages };
  pill = standing;
  return () => {
    if (pill === standing) pill = null;
  };
}

/**
 * In place of `withThreadDismissal` for T3's row actions (`features/home/useThreadListActions.ts`):
 * a sleep, snooze or wake tells the Cell lifting out of its row where it goes.
 */
export function toward(action: string) {
  return <T>(key: string, run: () => Promise<T>, succeeded: (result: T) => boolean) => {
    const stage = STAGE_OF[action];
    if (stage !== undefined) heading.set(key, stage);
    // T3 calls the row's dismissals before its first await, so they read the heading.
    try {
      return withThreadDismissal(key, run, succeeded);
    } finally {
      heading.delete(key);
    }
  };
}

/**
 * A swipe let the row of `key` go at `speed` across (pt/s): its Cell leaves it thrown. Called
 * from the release, before the move it commits starts the row's dismissal.
 */
export function thrown(key: string, speed: number, now = Date.now()): void {
  throws.set(key, { speed, at: now });
}

function throwOf(key: string, now: number): number {
  const at = throws.get(key);
  throws.delete(key);
  return at !== undefined && now - at.at < THROW_MS ? at.speed : 0;
}

/**
 * The row of `key` leaves `fromStage` by the person's hand, and its Cell lifts out of `figure`;
 * with too many in the air, only its count ticks. Returns the way back, for a move that failed.
 */
export function departs(
  key: string,
  thread: EnvironmentThreadShell,
  fromStage: HopStage,
  figure: Measurable,
  track: AnimatedRef<View> | null = null,
): () => void {
  if (hops.delete(key)) changed();
  if (hops.size >= LIST_MOTION.mostAtOnce) return () => undefined;
  const departure: Departure = { fromStage };
  const known = heading.get(key);
  const toStage = known === other(fromStage) ? known : null;
  const speed = throwOf(key, Date.now());
  departures.set(key, departure);
  figure.measureInWindow((x, y, width, height) => {
    if (width === 0 || departures.get(key) !== departure) return;
    if (toStage !== null) departures.delete(key);
    const from = { x, y, width, height };
    departed += 1;
    const hop: Hop = {
      key,
      id: departed,
      thread,
      from,
      fromStage,
      toStage,
      to: null,
      fades: false,
      thrown: speed,
      caught: false,
      track,
    };
    hops.set(key, hop);
    changed();
    if (toStage !== null) aim(key, toStage);
  });
  setTimeout(() => {
    if (departures.get(key) !== departure) return;
    departures.delete(key);
    fade(key);
  }, WAIT_MS);
  return () => {
    if (departures.get(key) === departure) departures.delete(key);
    if (hops.delete(key)) changed();
  };
}

function fade(key: string): void {
  const hop = hops.get(key);
  if (hop === undefined || hop.toStage !== null) return;
  hops.set(key, { ...hop, fades: true });
  changed();
}

/**
 * Reads the line for the Cells on their way: one still in the stage it left waits, one gone
 * from the home (archived, deleted) fades, and one anywhere else moved to the other stage. A
 * woken Cell can stand in neither stage until its machine's next reading; it moved all the same.
 */
export function resolveHops(
  inStage: (key: string, stage: HopStage) => boolean,
  exists: (key: string) => boolean,
): void {
  for (const [key, { fromStage }] of departures) {
    if (inStage(key, fromStage)) continue;
    departures.delete(key);
    if (!exists(key)) {
      fade(key);
      continue;
    }
    const toStage = other(fromStage);
    const hop = hops.get(key);
    if (hop === undefined) continue;
    hops.set(key, { ...hop, toStage });
    changed();
    aim(key, toStage);
  }
}

/** The Cell of `key` goes to `toStage`: it flies once its segment of the pill is measured. */
function aim(key: string, toStage: HopStage): void {
  const standing = pill;
  if (standing === null) {
    hopLanded(key);
    return;
  }
  setTimeout(() => {
    const waiting = hops.get(key);
    if (waiting?.toStage === toStage && waiting.to === null) hopLanded(key);
  }, PILL_MS);
  standing.view.measureInWindow((x, y, width, height) => {
    const flying = hops.get(key);
    if (flying?.toStage !== toStage) return;
    const index = standing.stages.indexOf(toStage);
    if (width === 0 || index < 0) {
      hopLanded(key);
      return;
    }
    const to = segmentOf({ x, y, width, height }, index, standing.stages.length);
    hops.set(key, { ...flying, to });
    changed();
  });
}

function bumped(stage: HopStage): void {
  bump = { stage, count: (bump?.count ?? 0) + 1 };
}

/** The Cell of `key` has touched down in its count: the count takes it now, as it sinks in. */
export function hopCaught(key: string): void {
  const hop = hops.get(key);
  if (hop === undefined || hop.caught || hop.toStage === null) return;
  hops.set(key, { ...hop, caught: true });
  bumped(hop.toStage);
  changed();
}

/** The Cell of `key` is in its stage's count: the count takes it with a bump, if it hasn't yet. */
export function hopLanded(key: string): void {
  const hop = hops.get(key);
  if (hop === undefined) return;
  hops.delete(key);
  if (hop.toStage !== null && !hop.caught) bumped(hop.toStage);
  changed();
}

/** The Cell of `key` has faded where it waited. */
export function hopFaded(key: string): void {
  if (hops.delete(key)) changed();
}

/** The rows of `keys` entered `stage` (`enteredRows`): each enters the first time it's seen there. */
export function arrive(keys: readonly string[], stage: LineStage, now = Date.now()): void {
  if (keys.length === 0) return;
  for (const [key, { at }] of arrivals) if (now - at >= ARRIVAL_MS) arrivals.delete(key);
  for (const key of keys) arrivals.set(key, { stage, at: now });
  changed();
}

/** The row of `key` has entered, or left before it could. */
export function arrivalDone(key: string): void {
  if (arrivals.delete(key)) changed();
}

/** Of the Cells `counted` in `stage`, how many are still on their way there: its count holds them. */
export function inbound(
  flying: readonly Hop[],
  stage: HopStage,
  counted: (key: string) => boolean,
) {
  return flying.filter((hop) => hop.toStage === stage && !hop.caught && counted(hop.key)).length;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The Cells in the air, and those waiting over their rows. */
export const hopsNow = (): readonly Hop[] => shown;

export function useHops(): readonly Hop[] {
  return useSyncExternalStore(subscribe, hopsNow);
}

/** Whether the Cell of `key` has left its row: the row's own stands empty. */
export function useLifted(key: string): boolean {
  return useSyncExternalStore(subscribe, () => hops.has(key));
}

/** Whether the row for `key` in `stage` has an entrance to make at `now`. */
export function arrivesNow(key: string, stage: string | null, now = Date.now()): boolean {
  const arrival = arrivals.get(key);
  return arrival?.stage === stage && now - arrival.at < ARRIVAL_MS;
}

export function useArrives(key: string, stage: string | null): boolean {
  return useSyncExternalStore(subscribe, () => arrivesNow(key, stage));
}

/** The latest landing, for its segment's bump. */
export const bumpNow = (): { readonly stage: HopStage; readonly count: number } | null => bump;

export function useBump() {
  return useSyncExternalStore(subscribe, bumpNow);
}
