/**
 * Whether Aski's tab is in the strip (Settings › Aski): off unless the person turned it on.
 * Off, no window sets up Aski's chat, so no instance or thread is made for it. Kept in local
 * storage, so every window of the app on this device reads the same.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stemcells.askiTab";
const ON = "on";

const listeners = new Set<() => void>();

function readAskiTabOn(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === ON;
  } catch {
    return false;
  }
}

export function setAskiTabOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, ON);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage refused: the switch holds in this window until it reloads.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
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

export function useAskiTabOn(): boolean {
  return useSyncExternalStore(subscribe, readAskiTabOn, () => false);
}
