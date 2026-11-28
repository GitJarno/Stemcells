// The Cell a turn to Aski came from (stemcells/tasks/aski-side.md, decision 4): what "this"
// means in the next message. Held beside Aski's composer, never in its draft, so the field is
// the person's words alone; it joins the message only as it goes.

import { useSyncExternalStore } from "react";

import type { AskiRef } from "./turn";

export interface CellRef {
  readonly environmentId: string;
  readonly threadId: string;
}

const carried = new Map<string, CellRef>();
const listeners = new Set<() => void>();
const keyOf = (aski: AskiRef) => `${aski.environmentId}\n${aski.threadId}`;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** The Cell the person turned to this Aski chat from; null leaves none. */
export function carry(aski: AskiRef, from: CellRef | null): void {
  const key = keyOf(aski);
  if (from === null ? !carried.delete(key) : carried.get(key) === from) return;
  if (from !== null) carried.set(key, from);
  for (const listener of listeners) listener();
}

export const carriedTo = (aski: AskiRef): CellRef | null => carried.get(keyOf(aski)) ?? null;

export function useCarried(aski: AskiRef): CellRef | null {
  const read = () => carriedTo(aski);
  return useSyncExternalStore(subscribe, read, read);
}

/** Whether a message can take the Cell along: it has words, and isn't a command, which works only as the text's start. */
export const takesCell = (text: string): boolean => {
  const words = text.trim();
  return words.length > 0 && !words.startsWith("/");
};
