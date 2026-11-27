// The home's tab for the views T3's home renders inside it (its header, its shelves): the
// line's segments (`line/line.ts`). The tab is the person's for the app's run; until they pick
// one, the home opens where `opens` says, and holds it from there.

import { createContext, useSyncExternalStore } from "react";
import type { SharedValue } from "react-native-reanimated";

import { drawnMoonPhase } from "../line/kit";
import type { CellState } from "../line/line";

export interface HomeTabs {
  readonly tab: string;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly count: number;
  }>;
  readonly choose: (tab: string) => void;
  /** The machine the list is narrowed to, whose Aski the header opens. */
  readonly environmentId: string | null;
}

/** Set inside the home: its scroll views draw no band under the header (`upstream/substitutes/NativeScrollViewMarker.tsx`). */
export const NoHeaderBand = createContext(false);

/** Set while the home shows its tabs: T3's own home, searching, shows none. */
export const HomeTabsContext = createContext<HomeTabs | null>(null);

/**
 * The stage a list of the home's tabs shows, set around each stage's own list: every stage's
 * list stays mounted, so what a row draws for its tab goes by its own list, not the tab chosen.
 */
export const HomeStageContext = createContext<string | null>(null);

/** Whether a stage's rows are Awake's: Input's are too, a lens over it (stemcells/tasks/inbox.md). */
export const awakeRows = (stage: string | null): boolean => stage === "awake" || stage === "needs";

/** Each awake Cell's state on the line, by `environmentId:id`, for its row's light and time. */
export const CellStates = createContext<ReadonlyMap<string, CellState>>(new Map());

/** One stage's list as the home switches between them (`StagePages.tsx`). */
export interface StagePage {
  /** The stage in front: it takes touches and the status bar's tap to the top. */
  readonly active: boolean;
  /** The inset every stage's scroll view rests under, set by hand: each rests at minus this. */
  readonly inset: number;
  /** How far this stage's list has carried the title up (`headLift`), on the UI thread. */
  readonly lift: SharedValue<number>;
}

export const StagePageContext = createContext<StagePage | null>(null);

/**
 * Whether the home is on screen: in front, or in a sidebar column beside a chat (T3's `visible`).
 * A Cell forms only where it's seen (`cell/forming.ts`), on one clock wherever it shows, so one
 * Aski starts behind a chat forms on the way back. Rows outside the home leave forming to the chat.
 */
export const HomeInFront = createContext(false);

/**
 * Set while the home is under a chat: its Cells stand still and read no
 * clock. Each one drawing on the sprite clock re-rendered its picture on the
 * JS thread up to 12 times a second, under the chat in front.
 */
export const HomeCellsHeld = createContext(false);

/** One set of tabs' choice: the person's, else where the home opens. */
export function tabChoice<Tab extends string>() {
  let chosen: Tab | null = null;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    choose(tab: Tab) {
      if (chosen === tab) return;
      chosen = tab;
      for (const listener of listeners) listener();
    },
    /** The tab shown: the person's, else `opens`. */
    useTab(opens: Tab): Tab {
      return useSyncExternalStore(subscribe, () => chosen) ?? opens;
    },
  };
}

/**
 * Where a stage's list starts across as it is chosen: from the side it travels from, `shift`
 * away, unless it still shows (a tap back mid-switch), when it carries on from where it stands.
 */
export function enteringX(
  opacity: number,
  x: number,
  from: number,
  to: number,
  shift: number,
): number {
  "worklet";
  return opacity > 0 ? x : Math.sign(to - from) * shift;
}

/**
 * How far a stage's list carries the title up, points: as far as it stands past its rest (minus
 * its top inset), never further than it can scroll, so a list too short to scroll never moves the
 * title, and nor does a pull past either end.
 */
export function headLift(
  offset: number,
  insetTop: number,
  insetBottom: number,
  contentHeight: number,
  viewportHeight: number,
): number {
  "worklet";
  const reach = insetTop + contentHeight + insetBottom - viewportHeight;
  return Math.min(Math.max(0, offset + insetTop), Math.max(0, reach));
}

/** How much of the title shows `lift` up a bar `bar` tall: whole at rest, gone past the bar, eased. */
export function headShown(lift: number, bar: number): number {
  "worklet";
  const t = Math.min(1, Math.max(0, lift / Math.max(1, bar)));
  return 1 - t * t * (3 - 2 * t);
}

let footRoom = 0;
const footListeners = new Set<() => void>();

/** How much of the list's foot a notice over it covers, so its last row can scroll clear. */
export function setFootRoom(height: number) {
  if (height === footRoom) return;
  footRoom = height;
  for (const listener of footListeners) listener();
}

export function useFootRoom(): number {
  return useSyncExternalStore(
    (listener) => {
      footListeners.add(listener);
      return () => void footListeners.delete(listener);
    },
    () => footRoom,
  );
}

/** The stages' pill's height (`StagePill.tsx`). */
export const PILL_HEIGHT = 36;
/** What the stages' pill takes of the home's foot or top: its height and a gap. */
export const PILL_ROOM = PILL_HEIGHT + 8;
/** Room over each stage's first row, under the header's sky (`Sky.tsx`). */
export const STAGE_ROOM = 8;

/**
 * The pill's foot as the keyboard moves: from `rest` to `above` over the keyboard's top, never
 * under its rest, in step with the keyboard's `progress` as T3's composer moves
 * (`KeyboardStickyView`). `keyboard` is the keyboard's height now.
 */
export function pillBottom(rest: number, above: number, keyboard: number, progress: number) {
  "worklet";
  return rest + Math.max(0, keyboard + progress * (above - rest));
}

const lifts = new Map<object, number>();
let lift = 0;
const liftListeners = new Set<() => void>();
const tellLift = () => {
  lift = lifts.size === 0 ? 0 : Math.max(...lifts.values());
  for (const listener of liftListeners) listener();
};

/** The stages' pill stands where T3's notice would, so the notice stands `by` higher (or lower). */
export function liftNotices(by: number): () => void {
  const key = {};
  lifts.set(key, by);
  tellLift();
  return () => {
    lifts.delete(key);
    tellLift();
  };
}

export function useNoticeLift(): number {
  return useSyncExternalStore(
    (listener) => {
      liftListeners.add(listener);
      return () => void liftListeners.delete(listener);
    },
    () => lift,
  );
}

let minute = new Date().toISOString();
const ticks = new Set<() => void>();
let ticking: ReturnType<typeof setInterval> | undefined;

const onMinute = (listener: () => void) => {
  ticks.add(listener);
  if (ticking === undefined) {
    minute = new Date().toISOString();
    ticking = setInterval(() => {
      minute = new Date().toISOString();
      for (const tick of ticks) tick();
    }, 60_000);
  }
  return () => {
    ticks.delete(listener);
    if (ticks.size === 0) {
      clearInterval(ticking);
      ticking = undefined;
    }
  };
};

/** The time, an ISO string, moving each minute on one clock for the whole home: a snooze wakes on it. */
export function useMinute(): string {
  return useSyncExternalStore(onMinute, () => minute);
}

/** The moon's drawn phase, on the minute's clock: it changes, and renders, a few times a day. */
export function useMoonPhase(): number {
  return useSyncExternalStore(onMinute, () => drawnMoonPhase(Date.parse(minute)));
}
