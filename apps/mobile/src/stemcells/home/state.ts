// The home's tab for the views T3's home renders inside it (its header, its shelves): the
// line's segments (`line/line.ts`), or Asleep, Active, Working and Input where a machine has no
// line (`tabs.ts`). The tab is the person's for the app's run; until they pick one, the home
// opens where `opens` says, and holds it from there.

import { createContext, useEffect, useSyncExternalStore } from "react";

import type { TabCounts } from "./tabs";

export interface HomeTabs {
  readonly tab: string;
  readonly options: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly count: number;
  }>;
  /** The home in Aski's terms, for its line (`greeting.ts`). */
  readonly counts: TabCounts;
  /** The night comes over Aski: the tab of Cells put away. */
  readonly night: boolean;
  readonly choose: (tab: string) => void;
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

/**
 * Set while the home is under a chat: its Cells stand still and read no
 * clock. Each one drawing on the sprite clock re-rendered its picture on the
 * JS thread up to 12 times a second, under the chat in front.
 */
export const HomeCellsHeld = createContext(false);

/** One set of tabs' choice: the person's, else where the home opens, held once known. */
export function tabChoice<Tab extends string>() {
  let chosen: Tab | null = null;
  const listeners = new Set<() => void>();
  const choose = (tab: Tab) => {
    if (chosen === tab) return;
    chosen = tab;
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
  return {
    choose,
    /** The tab shown: the person's, else `opens`, chosen for good once `known`. */
    useTab(opens: Tab, known: boolean): Tab {
      const tab = useSyncExternalStore(subscribe, () => chosen);
      // oxlint-disable-next-line t3code/react-effect-budget -- Choose the opening tab in the shared tab store once the counts are known.
      useEffect(() => {
        if (known && chosen === null) choose(opens);
      }, [known, opens]);
      return tab ?? opens;
    },
  };
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
