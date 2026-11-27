/**
 * Whether the Cell over a composer is drawn from its model (Settings › Collection › Cells): a
 * preview, off unless the person turned it on. Kept in local storage, so every window of the
 * app on this device reads the same (`stemcells/tasks/cell-model.md`).
 */
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "stemcells.cellModel";
const ON = "on";

const listeners = new Set<() => void>();

function readCellModelOn(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === ON;
  } catch {
    return false;
  }
}

export function setCellModelOn(on: boolean): void {
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

export function useCellModelOn(): boolean {
  return useSyncExternalStore(subscribe, readCellModelOn, () => false);
}
