// Ours in the Duo's side rail (the trophy on Usage, then Aski), over its tab group
// (`railPlace.ts`): which of them stand there now (`stemcells/tasks/duo-collection.md`).
import { createContext, use, useEffect, useState, useSyncExternalStore } from "react";

export { railStyle } from "./railPlace";

interface Rail {
  /** What the trophy opens, while Usage stands in front beside the rail. */
  readonly trophy: (() => void) | null;
  /** How many of ours stand in the rail: the trophy and Aski, each when it shows. */
  readonly ours: number;
}

const trophies: Array<{ readonly key: object; readonly open: () => void }> = [];
const listeners = new Set<() => void>();
let askiShows = 0;
let rail: Rail = { trophy: null, ours: 0 };

function changed() {
  const trophy = trophies.at(-1)?.open ?? null;
  rail = {
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
 * Whether the screen asking has navigation's focus. The app hands it in as it starts
 * (`pages.tsx`), so this store pulls in no navigator.
 */
const NoNavigator = createContext(true);
let useFocused: () => boolean = () => use(NoNavigator);

export function railFocusFrom(hook: () => boolean) {
  useFocused = hook;
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

/** Aski's button says it shows, so the trophy stands over the tabs itself when it doesn't. */
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
