/**
 * The settles the person sent from this device. Upstream's auto-settle (a
 * merged pull request, a quiet day) leaves a thread just as the person's
 * Settle does (`settledOverride: "settled"`), so the thread can't tell a
 * pane which it was. Each settle the person sends leaves its mark here
 * first, kept in local storage so every window of the app hears it, and a
 * pane leaves only for a settle whose mark is fresh (`settled.ts`).
 */
import { useSyncExternalStore } from "react";

import type { CellRef } from "./layout";

const STORAGE_KEY = "stemcells.handSettles";

/** Long enough for a slow server's answer to reach every window. */
export const HAND_SETTLE_MS = 10_000;

interface Thread {
  readonly environmentId: string;
  readonly threadId: string;
}

/** When the person settled each Cell, by its environment and thread. */
export type Marks = Readonly<Record<string, number>>;

const keyOf = (thread: Thread) => JSON.stringify([thread.environmentId, thread.threadId]);

/** The marks with this one, less those too old to count. */
export function withMark(marks: Marks, thread: Thread, at: number): Marks {
  const kept = Object.entries(marks).filter(([, markedAt]) => at - markedAt < HAND_SETTLE_MS);
  return Object.fromEntries([...kept, [keyOf(thread), at]]);
}

export function withoutMark(marks: Marks, thread: Thread): Marks {
  const key = keyOf(thread);
  return Object.fromEntries(Object.entries(marks).filter(([each]) => each !== key));
}

export function markedAt(marks: Marks, thread: Thread | null): number | null {
  return thread === null ? null : (marks[keyOf(thread)] ?? null);
}

function parse(value: string | null): Marks {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}

// What local storage holds, read again once another window writes it.
let held: Marks | null = null;
const listeners = new Set<() => void>();

function read(): Marks {
  if (held === null) {
    try {
      held = typeof localStorage === "undefined" ? {} : parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      held = {};
    }
  }
  return held;
}

function write(marks: Marks): void {
  held = marks;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // Storage refused: the mark holds in this window alone.
  }
  for (const listener of listeners) listener();
}

/** Before the settle goes: its answer may reach a window before the command returns. */
export function markHandSettle(thread: Thread): void {
  write(withMark(read(), thread, Date.now()));
}

/** The settle failed, so nothing closes for it. */
export function unmarkHandSettle(thread: Thread): void {
  write(withoutMark(read(), thread));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const elsewhere = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    held = null;
    listener();
  };
  window.addEventListener("storage", elsewhere);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", elsewhere);
  };
}

/** When the person last settled the chat from this device, or null. */
export function useHandSettledAt(cell: CellRef | null): number | null {
  const thread = cell !== null && cell.draftId === null ? cell : null;
  return useSyncExternalStore(
    subscribe,
    () => markedAt(read(), thread),
    () => null,
  );
}
