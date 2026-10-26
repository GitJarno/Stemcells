// The home's tab for the views T3's home renders inside it (its header, its
// shelves): which tab shows and how many each holds. The tab is the
// person's for the app's run; until they pick one, the home opens on Input
// when anything waits on them, else on Active, and holds it from there.

import { createContext, useEffect, useSyncExternalStore } from "react";

import type { HomeTab, TabCounts } from "./tabs";

export interface HomeTabs {
  readonly tab: HomeTab;
  readonly counts: TabCounts;
  readonly choose: (tab: HomeTab) => void;
  /** The machine the list is narrowed to, whose Aski the header opens. */
  readonly environmentId: string | null;
}

/** Set while the home shows its tabs: T3's own home, searching, shows none. */
export const HomeTabsContext = createContext<HomeTabs | null>(null);

/**
 * Whether the home is the screen in front. T3's home stays mounted under a
 * chat and keeps drawing its rows; a Cell forms only where it's seen
 * (`cell/forming.ts`), so one Aski starts meanwhile forms on the way back.
 * Rows outside the home (the iPad's sidebar) leave forming to the chat.
 */
export const HomeInFront = createContext(false);

let chosen: HomeTab | null = null;
const listeners = new Set<() => void>();

export function chooseTab(tab: HomeTab): void {
  if (chosen === tab) return;
  chosen = tab;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The tab shown: the person's, else where the home opens with `counts`, held once `known`. */
export function useHomeTab(counts: TabCounts, known: boolean): HomeTab {
  const tab = useSyncExternalStore(subscribe, () => chosen);
  const opens: HomeTab = counts.input > 0 ? "input" : "active";
  // oxlint-disable-next-line t3code/react-effect-budget -- Choose the opening tab in the shared tab store once the counts are known.
  useEffect(() => {
    if (known && chosen === null) chooseTab(opens);
  }, [known, opens]);
  return tab ?? opens;
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
