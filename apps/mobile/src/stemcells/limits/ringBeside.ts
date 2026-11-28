// Whether a chat's bar beside the home shows the plan ring (`upstream/substitutes/AppBar.tsx`):
// while one does, the home's header leaves its own out, so the ring stands once, over the chat.

import { useSyncExternalStore } from "react";

let beside = 0;
const listeners = new Set<() => void>();

function changed(by: number) {
  beside += by;
  for (const listener of listeners) listener();
}

/** A chat's bar beside the home shows the ring until the returned release. */
export function holdRingBeside(): () => void {
  changed(1);
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    changed(-1);
  };
}

export function useRingBeside(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => beside > 0,
  );
}
