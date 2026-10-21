// What each moment played for lately, kept in local storage: the nights it
// marked, the Cells, the messages, newest first. A moment that plays once
// per something asks here first, and is marked once it plays.

import type { MomentId } from "./cards.ts";

const STORAGE_KEY = "stemcells.askiMoments";
/** How many of what each moment played for are kept. */
const KEPT = 20;

function readAll(): Partial<Record<MomentId, string[]>> {
  try {
    if (typeof localStorage === "undefined") return {};
    const kept: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof kept !== "object" || kept === null) return {};
    // A moment kept before lists were is its one entry.
    return Object.fromEntries(
      Object.entries(kept).map(([id, what]) => [
        id,
        Array.isArray(what) ? what.filter((w) => typeof w === "string") : [String(what)],
      ]),
    );
  } catch {
    return {};
  }
}

/** What moment `id` last played for, if anything. */
export const lastPlayed = (id: MomentId): string | undefined => readAll()[id]?.[0];

/** Whether moment `id` played for `what` lately. */
export const playedFor = (id: MomentId, what: string): boolean =>
  readAll()[id]?.includes(what) ?? false;

/** Marks moment `id` as played for `what`. */
export function markPlayed(id: MomentId, what: string): void {
  try {
    const all = readAll();
    const kept = [what, ...(all[id] ?? []).filter((w) => w !== what)].slice(0, KEPT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [id]: kept }));
  } catch {
    // Storage refused: the moment may play for it again.
  }
}
