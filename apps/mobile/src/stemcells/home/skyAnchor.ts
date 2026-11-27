// The header's button the sun and the moon stand behind (`scope.tsx`'s folder), so the sky reads
// where it is rather than guessing past the title and the battery (`Sky.tsx`).

import { useSyncExternalStore } from "react";
import type { ViewInstance } from "react-native";

let anchor: ViewInstance | null = null;
const listeners = new Set<() => void>();

function told() {
  for (const listener of listeners) listener();
}

/** The button's view as it mounts, and null as it goes: a ref callback. */
export function holdSkyAnchor(view: ViewInstance | null) {
  if (view === anchor) return;
  anchor = view;
  told();
}

/** The button was laid out again: the sky reads its place anew. */
export function movedSkyAnchor() {
  told();
}

/** Called whenever the button comes, goes or is laid out. */
export function subscribeSkyAnchor(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSkyAnchor(): ViewInstance | null {
  return useSyncExternalStore(subscribeSkyAnchor, () => anchor);
}
