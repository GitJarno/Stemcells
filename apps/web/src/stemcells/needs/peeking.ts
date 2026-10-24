/**
 * The Cell Aski's room is peeking at: its chat slides in from the right
 * over the room, and goes once the person has said their piece
 * (stemcells/tasks/aski-manager.md, decision 9). One at a time.
 */
import { useSyncExternalStore } from "react";

let peeking: string | null = null;
const listeners = new Set<() => void>();

function set(next: string | null) {
  if (peeking === next) return;
  peeking = next;
  for (const listener of listeners) listener();
}

/** Peeks at a Cell's chat, by its thread. */
export const openPeek = (threadId: string): void => set(threadId);
export const closePeek = (): void => set(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => peeking;

/** The thread being peeked at, or null. */
export function usePeek(): string | null {
  return useSyncExternalStore(subscribe, read, read);
}
