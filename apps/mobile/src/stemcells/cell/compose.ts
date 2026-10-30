// A Cell's scenes are composed the first time one is shown, a few
// milliseconds each on the phone. A screen of new Cells would pay for all of
// them in its first frame, so a figure asks here and draws once its turn
// comes: a slice of the queue a tick, each slice short of a frame.

import { useCallback, useSyncExternalStore } from "react";

/** How long one slice of the queue may run, in milliseconds. */
const SLICE_MS = 8;

const done = new Set<string>();
const queue = new Map<string, () => void>();
const waiting = new Map<string, Set<() => void>>();
let draining = false;

function drain(): void {
  const until = Date.now() + SLICE_MS;
  for (const [key, compose] of queue) {
    if (Date.now() > until) break;
    queue.delete(key);
    try {
      compose();
    } finally {
      done.add(key);
      for (const wake of waiting.get(key) ?? []) wake();
      waiting.delete(key);
    }
  }
  draining = queue.size > 0;
  if (draining) setTimeout(drain, 0);
}

/** Whether what `key` names has been composed; asked once, `compose` runs in its turn and the caller draws again. */
export function useComposed(key: string, compose: () => void): boolean {
  // Read through a store: the React Compiler caches a module read like `done.has(key)` per key,
  // and an effect misses a key composed between its render and its subscribing.
  const subscribe = useCallback(
    (wake: () => void) => {
      if (done.has(key)) return () => {};
      const listeners = waiting.get(key) ?? new Set();
      listeners.add(wake);
      waiting.set(key, listeners);
      if (!queue.has(key)) queue.set(key, compose);
      if (!draining) {
        draining = true;
        setTimeout(drain, 0);
      }
      return () => {
        listeners.delete(wake);
      };
    },
    [key, compose],
  );
  return useSyncExternalStore(subscribe, () => done.has(key));
}
