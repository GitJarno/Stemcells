// Whether the plans' sheet is open. A ring sits in a native header, which can rebuild its items
// under it, so the sheet stands over the workspace (`pages.tsx`) and the rings only open it.

import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export const showPlans = () => set(true);
export const hidePlans = () => set(false);

export function usePlansShown(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
  );
}
