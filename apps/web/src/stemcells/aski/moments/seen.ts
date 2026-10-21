// What each moment last played for, kept in local storage: the night it
// marked, the Cell, the message. A moment that plays once per something
// asks here first, and is marked once it plays.

import type { MomentId } from "./cards.ts";

const STORAGE_KEY = "stemcells.askiMoments";

function readAll(): Partial<Record<MomentId, string>> {
  try {
    if (typeof localStorage === "undefined") return {};
    const kept: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return typeof kept === "object" && kept !== null ? kept : {};
  } catch {
    return {};
  }
}

/** Whether moment `id` last played for `what`. */
export const playedFor = (id: MomentId, what: string): boolean => readAll()[id] === what;

/** Marks moment `id` as played for `what`. */
export function markPlayed(id: MomentId, what: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [id]: what }));
  } catch {
    // Storage refused: the moment may play for it again.
  }
}
