// A Cell arriving where a click on its name sent it: the pane showing it rings once, so the
// person sees which one it is (stemcells/tasks/cell-tokens.md). The ring ends itself; one that
// finds no pane (the chat opened in another window) is let go after its length.
import { useSyncExternalStore } from "react";

const RING_MS = 900;

let ringing: { readonly threadId: string; readonly count: number } | null = null;
const listeners = new Set<() => void>();

function tell() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rings the pane showing this chat, once. */
export function ringCell(threadId: string): void {
  const count = (ringing?.count ?? 0) + 1;
  ringing = { threadId, count };
  tell();
  setTimeout(() => {
    if (ringing?.count !== count) return;
    ringing = null;
    tell();
  }, RING_MS);
}

/** The ring a pane showing this chat plays, by a key new to each ring; null when none. */
export function useRing(threadId: string | null): number | null {
  const now = useSyncExternalStore(subscribe, () => ringing);
  return now !== null && threadId !== null && now.threadId === threadId ? now.count : null;
}
