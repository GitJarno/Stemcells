// The Duo's side rail, read where UIKit is handed it: the header of the screen in front names
// the buttons its top group stands, and ours (the trophy on Usage, then Aski) take the places
// after them, so they follow the group as it grows and shrinks (`stemcells/tasks/duo-collection.md`).
// T3's header hands its items here at its seam (`native/V5StackHeader.ios.tsx`).

import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";

import { NativeWorkspaceTabActivityContext, PaneContext } from "../upstream/pane";

export { railButtons, railStyle } from "./railPlace";

interface Rail {
  /** The top group's buttons, from the header of the screen in front; null before one says. */
  readonly top: number | null;
  /** What the trophy opens, while Usage stands in front beside the rail. */
  readonly trophy: (() => void) | null;
  /** How many of ours stand in the rail: the trophy and Aski, each when it shows. */
  readonly ours: number;
}

// The headers in front, newest last: a pushed page's comes in over the one under it.
const fronts: Array<{ readonly key: object; readonly count: number }> = [];
const trophies: Array<{ readonly key: object; readonly open: () => void }> = [];
const listeners = new Set<() => void>();
let askiShows = 0;
let rail: Rail = { top: null, trophy: null, ours: 0 };

function changed() {
  const trophy = trophies.at(-1)?.open ?? null;
  rail = {
    top: fronts.at(-1)?.count ?? null,
    trophy,
    ours: (trophy === null ? 0 : 1) + (askiShows > 0 ? 1 : 0),
  };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRail(): Rail {
  return useSyncExternalStore(subscribe, () => rail);
}

/**
 * Whether the screen a header stands in has navigation's focus. The app hands it in as it starts
 * (`pages.tsx`), before any header draws, so T3's header pulls in no navigator with this store.
 */
const NoNavigator = createContext(true);
let useFocused: () => boolean = () => use(NoNavigator);

export function railFocusFrom(hook: () => boolean) {
  useFocused = hook;
}

/** A header names its rail buttons while its screen is in front and its bar is shown. */
export function useRailGroup(count: number, hidden: boolean) {
  const focused = useFocused();
  // An inspector's pane keeps a bar of its own beside the chat it inspects.
  const inspector = use(PaneContext) === "inspector";
  // T3 keeps each workspace tab's header mounted; only the shown tab's is in the rail.
  const shown = use(NativeWorkspaceTabActivityContext)?.active !== false;
  const [key] = useState(() => ({}));
  const says = focused && shown && !hidden && !inspector;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the rail's store, read by Aski's layer over the window, what this header stands while it is in front
  useEffect(() => {
    if (!says) return;
    fronts.push({ key, count });
    changed();
    return () => {
      fronts.splice(
        fronts.findIndex((each) => each.key === key),
        1,
      );
      changed();
    };
  }, [says, count, key]);
}

/** Usage asks for the trophy in the rail while it stands in front. */
export function useRailTrophy(open: (() => void) | null) {
  const focused = useFocused();
  const [key] = useState(() => ({}));
  const wanted = focused && open !== null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the rail's store, read by the layer over the window, that Usage is in front and what its trophy opens
  useEffect(() => {
    if (!wanted || open === null) return;
    trophies.push({ key, open });
    changed();
    return () => {
      trophies.splice(
        trophies.findIndex((each) => each.key === key),
        1,
      );
      changed();
    };
  }, [wanted, open, key]);
}

/** Aski's button says it shows, so the trophy closes up to the group when it doesn't. */
export function useRailAski() {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the rail's store, read by the trophy's layer, that Aski's button stands in the rail
  useEffect(() => {
    askiShows += 1;
    changed();
    return () => {
      askiShows -= 1;
      changed();
    };
  }, []);
}
