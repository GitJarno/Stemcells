// The home's undo line (`UndoLine.tsx`), for an act already done that would lose something
// without it: a hidden disk notice (`disk/DiskPlate.tsx`). Answers, Sleep and Wake keep none
// (stemcells/tasks/no-undo.md). One line at a time: a newer act takes the place of the last.

import { useSyncExternalStore } from "react";

export interface Done {
  readonly key: string;
  readonly words: string;
  readonly takeBack: () => unknown;
}

/** How long the line stands, as T3's own undo notice does. */
const LINE_MS = 5_000;

let line: Done | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function show(next: Done | null) {
  clearTimeout(timer);
  line = next;
  if (next !== null) timer = setTimeout(() => show(null), LINE_MS);
  for (const listener of listeners) listener();
}

/** Shows an act already done on the line, with Undo. */
export const did = (done: Done): void => show(done);

/** Takes the act on the line back. */
export function undo(): void {
  const done = line;
  show(null);
  done?.takeBack();
}

/** The line goes now; its act stands. */
export const letGo = (): void => show(null);

export function useTakeBack(): Done | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => line,
  );
}
