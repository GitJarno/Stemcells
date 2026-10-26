/**
 * The kinds of ask that show the Cell's words whole, not two lines: the ones the person flagged
 * often this week (stemcells/tasks/aski-asks.md, decision 13; the rule is the server's,
 * `asks/ledger.ts`). Read once a page, and again after each flag.
 */
import { useSyncExternalStore } from "react";

import { openPrimaryStream } from "../upstream/needs";

interface Measure {
  readonly kinds: ReadonlyArray<{ readonly kind: string; readonly whole: boolean }>;
}

let kinds: ReadonlySet<string> = new Set();
let read = false;
const listeners = new Set<() => void>();

/** Reads the week's measure again; a failed read keeps what was known. */
export function rereadWholeKinds(): void {
  read = true;
  void openPrimaryStream("/api/stemcells/asks/measure", new AbortController().signal)
    .then((response) => (response.ok ? (response.json() as Promise<Measure>) : null))
    .catch(() => null)
    .then((measure) => {
      if (measure === null) return;
      kinds = new Set(measure.kinds.filter((each) => each.whole).map((each) => each.kind));
      for (const listener of listeners) listener();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!read) rereadWholeKinds();
  return () => void listeners.delete(listener);
}

export function useShowsWhole(kind: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => kinds.has(kind),
    () => false,
  );
}
