/**
 * Whether Aski divides the work (Settings › Aski): on unless the person
 * turned it off. Off, a message whose words don't say what each Cell does
 * waits until they do, as when there is no planner to ask, and no call
 * goes (`words/plan/`). It is kept in local storage, so every window of
 * the app on this device reads the same.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stemcells.aski.plans";
const OFF = "off";

/** Where the switch is kept: local storage in the page, anything alike in a test. */
export interface Shelf {
  read(): string | null;
  /** Null takes the value away: the switch is back to its default. */
  write(value: string | null): void;
}

const local: Shelf = {
  read: () => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write: (value) => {
    try {
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage refused: the switch holds in this window until it reloads.
    }
  },
};

const listeners = new Set<() => void>();

/** Whether Aski divides the work; anything kept but "off" reads as on. */
export function readAskiPlans(shelf: Shelf = local): boolean {
  return shelf.read() !== OFF;
}

/** Turns Aski's planning on or off, and tells everything reading it. */
export function setAskiPlans(on: boolean, shelf: Shelf = local): void {
  shelf.write(on ? null : OFF);
  for (const listener of listeners) listener();
}

/** Calls `listener` when the switch changes, here or in another window. */
export function subscribeAskiPlans(listener: () => void): () => void {
  listeners.add(listener);
  const elsewhere = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", elsewhere);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", elsewhere);
  };
}

export function useAskiPlans(): boolean {
  return useSyncExternalStore(
    subscribeAskiPlans,
    () => readAskiPlans(),
    () => true,
  );
}
