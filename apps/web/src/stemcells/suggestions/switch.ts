/**
 * Whether a finished Cell's composer suggests what to say next (Settings ›
 * Aski): on unless the person turned it off. Off, no page asks, so no
 * short call is made. Kept in local storage, so every window of the app on
 * this device reads the same.
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stemcells.suggestions";
const OFF = "off";

const listeners = new Set<() => void>();

function readSuggestionsOn(): boolean {
  try {
    return typeof localStorage === "undefined" || localStorage.getItem(STORAGE_KEY) !== OFF;
  } catch {
    return true;
  }
}

export function setSuggestionsOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, OFF);
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

export function useSuggestionsOn(): boolean {
  return useSyncExternalStore(subscribe, readSuggestionsOn, () => true);
}
