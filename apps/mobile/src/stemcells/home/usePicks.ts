// The home's picks (`picks.ts`), kept in a file of ours on the phone and read once, as the
// home first draws, so it opens already narrowed.

import { useSyncExternalStore } from "react";

import { readKept, writeKept } from "../upstream/home";
import { type Picks, picksFrom } from "./picks";

const FILE = "home-picks.json";

let picks: Picks | null = null;
const listeners = new Set<() => void>();

const read = () => {
  picks ??= picksFrom(readKept(FILE));
  return picks;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Takes the picks as they stand, so two ticks before a redraw both hold. */
export function setPicks(next: Picks | ((now: Picks) => Picks)) {
  picks = typeof next === "function" ? next(read()) : next;
  for (const listener of listeners) listener();
  void writeKept(FILE, JSON.stringify(picks));
}

export function usePicks(): Picks {
  return useSyncExternalStore(subscribe, read);
}
