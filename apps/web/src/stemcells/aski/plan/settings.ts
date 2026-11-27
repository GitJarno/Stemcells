/**
 * Settings › Aski › Starting several Cells (stemcells/tasks/aski-orchestrator.md, decision 7):
 * whether every plan waits for the person's check, and the most Cells one message starts without
 * one. Kept in local storage, so every window on this device reads the same.
 */
import { useSyncExternalStore } from "react";

import { CEILING, DEFAULT_CAP } from "../../../../../../stemcells/orchestrator/plan.ts";

const ALWAYS_KEY = "stemcells.aski.plan.always";
const CAP_KEY = "stemcells.aski.plan.cap";

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage refused: the setting holds until this window reloads.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const elsewhere = (event: StorageEvent) => {
    if (event.key === ALWAYS_KEY || event.key === CAP_KEY || event.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", elsewhere);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", elsewhere);
  };
}

/** Whether every plan waits for a check, not only one Aski is unsure of. */
export const readCheckAlways = (): boolean => read(ALWAYS_KEY) === "on";
export const setCheckAlways = (on: boolean): void => write(ALWAYS_KEY, on ? "on" : null);

/** The most Cells one message starts without a check: 1 to the ceiling. */
export function capOf(stored: string | null): number {
  const cap = Math.trunc(Number(stored ?? DEFAULT_CAP));
  return Number.isFinite(cap) ? Math.min(Math.max(cap, 1), CEILING) : DEFAULT_CAP;
}
export const readPlanCap = (): number => capOf(read(CAP_KEY));
export const setPlanCap = (cap: number): void =>
  write(CAP_KEY, capOf(String(cap)) === DEFAULT_CAP ? null : String(capOf(String(cap))));

export const useCheckAlways = (): boolean =>
  useSyncExternalStore(subscribe, readCheckAlways, () => false);
export const usePlanCap = (): number =>
  useSyncExternalStore(subscribe, readPlanCap, () => DEFAULT_CAP);
