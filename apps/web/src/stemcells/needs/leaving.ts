/**
 * The Cells the person is settling, off the column at once while upstream's settle runs
 * (stemcells/tasks/left-column-v3.md, decision 7): a Cell at work stops first, which can take
 * seconds. One comes back if its settle fails, and is let go once the server's list no longer
 * holds it, so a settle undone shows it again.
 */
import { useSyncExternalStore } from "react";

import type { NeedsState } from "./stream";

export interface LeavingDeps {
  readonly needs: () => NeedsState;
  /** Follows the server's list; returns the unsubscribe. */
  readonly subscribeNeeds: (listener: () => void) => () => void;
}

export function createLeaving(deps: LeavingDeps) {
  let leaving: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;

  function set(next: ReadonlySet<string>) {
    leaving = next;
    if (leaving.size > 0 && unsubscribe === null) unsubscribe = deps.subscribeNeeds(prune);
    if (leaving.size === 0 && unsubscribe !== null) {
      unsubscribe();
      unsubscribe = null;
    }
    for (const listener of listeners) listener();
  }

  const listed = (threadId: string): boolean => {
    const { needs, cells } = deps.needs();
    return (
      needs?.some((need) => need.threadId === threadId) === true ||
      cells?.some((cell) => cell.threadId === threadId) === true
    );
  };

  function prune() {
    const still = [...leaving].filter(listed);
    if (still.length < leaving.size) set(new Set(still));
  }

  function drop(threadId: string) {
    if (!leaving.has(threadId)) return;
    const next = new Set(leaving);
    next.delete(threadId);
    set(next);
  }

  return {
    /** Takes the Cell off while `settle` runs; it comes back when that fails. */
    async leaveWhile(threadId: string, settle: Promise<boolean>): Promise<boolean> {
      set(new Set([...leaving, threadId]));
      const settled = await settle.catch(() => false);
      if (!settled) drop(threadId);
      else if (!listed(threadId)) drop(threadId);
      return settled;
    },
    read: (): ReadonlySet<string> => leaving,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Leaving = ReturnType<typeof createLeaving>;

export function useLeaving(leaving: Leaving): ReadonlySet<string> {
  return useSyncExternalStore(leaving.subscribe, leaving.read, leaving.read);
}
