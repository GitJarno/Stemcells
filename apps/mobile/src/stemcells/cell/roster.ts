// The phone's crew: every Cell it knows (no Subcell, not Aski, none archived), first-born
// first, dealt its looks together: no two alike while the catalogue lasts, the same on the home
// and in its chat. As on the Mac (`apps/web/src/stemcells/tabs/roster.ts`), a Cell keeps its
// seat and its look while it stays; a newcomer sits after.

import { useMemo, useSyncExternalStore } from "react";

import { type EnvironmentThreadShell, useThreadShellsSelected } from "../upstream/cells";
import { askiChatsOf } from "../aski/chat";
import { dayOf, type Look, lookOf, looksOf } from "./kit";

let crewSeen: ReadonlyArray<EnvironmentThreadShell> | null = null;
let crewKey = "";

/** The crew's names (thread ids), the first-born first, as one key; every Cell in view asks of the same list, so the last answer is kept. */
function crewOf(threads: ReadonlyArray<EnvironmentThreadShell>): string {
  if (threads === crewSeen) return crewKey;
  const aski = askiChatsOf(threads);
  crewSeen = threads;
  crewKey = threads
    .filter(
      (thread) =>
        thread.archivedAt === null &&
        thread.lineage.relationshipToParent !== "subagent" &&
        !aski.has(thread.id),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((thread) => thread.id)
    .join(",");
  return crewKey;
}

let last: { key: string; seats: readonly string[]; looks: ReadonlyMap<string, Look> } = {
  key: "",
  seats: [],
  looks: new Map(),
};

function dealt(crew: string, day: string): ReadonlyMap<string, Look> {
  const key = `${day}|${crew}`;
  if (key === last.key) return last.looks;
  const names = crew === "" ? [] : crew.split(",");
  const present = new Set(names);
  const kept = last.seats.filter((name) => present.has(name));
  const seats = [...kept, ...names.filter((name) => !kept.includes(name))];
  last = { key, seats, looks: looksOf(seats, day, last.looks) };
  return last.looks;
}

// The day the crew is dealt on, turning at midnight.
let today = dayOf(new Date());
const listeners = new Set<() => void>();
let midnight: ReturnType<typeof setTimeout> | undefined;

function arm(): void {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  midnight = setTimeout(() => {
    today = dayOf(new Date());
    for (const listener of listeners) listener();
    arm();
  }, next.getTime() - now.getTime());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (midnight === undefined) {
    today = dayOf(new Date());
    arm();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(midnight);
      midnight = undefined;
    }
  };
}

/** What the Cell whose chat is `threadId` wears today; undefined for one outside the crew. */
export function useCellLook(threadId: string): readonly string[] | undefined {
  const crew = useThreadShellsSelected(crewOf);
  const day = useSyncExternalStore(subscribe, () => today);
  return dealt(crew, day).get(threadId)?.worn;
}

/**
 * What the Subcell named `name` wears today: no Subcell sits in the crew, so it is dealt alone,
 * the look the Mac gives one whose thread no tab shows (`apps/web/src/stemcells/cell/SubcellMark.tsx`).
 */
export function useSubcellLook(name: string): readonly string[] {
  const day = useSyncExternalStore(subscribe, () => today);
  return useMemo(() => lookOf(name, day), [name, day]);
}
