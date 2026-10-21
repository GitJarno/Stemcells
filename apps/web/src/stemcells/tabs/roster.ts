/**
 * The crew in view: every Cell the workspace shows (Aski's tab aside),
 * dealt its look together with the others (`cell/looks.ts`), so no two wear
 * the same while the catalogue lasts. A Cell takes its seat when it first
 * shows and keeps its look while it stays; one that leaves and comes back is
 * dealt again, as a newcomer.
 */
import { useSyncExternalStore } from "react";

import { dayOf, type Look, looksOf } from "../cell/looks";
import { isAskiTab } from "./askiTab";
import { panesOf, type Workspace } from "./layout";
import { useWorkspaceStore } from "./store";

/** The crew's names (thread ids), in the workspace's order, each once, Aski's tab aside. */
export function crewOf(workspace: Workspace): string[] {
  const names = workspace.tabs
    .filter((tab) => !isAskiTab(tab))
    .flatMap((tab) => panesOf(tab).flatMap((pane) => pane.cell?.threadId ?? []));
  return [...new Set(names)];
}

interface Deal {
  readonly key: string;
  readonly seats: readonly string[];
  readonly looks: ReadonlyMap<string, Look>;
}

let last: Deal = { key: "", seats: [], looks: new Map() };

/**
 * The looks of crew `names` on `day`: the seats of the last deal kept in
 * their order and their looks kept, newcomers seated after them.
 */
export function dealRoster(names: readonly string[], day: string): ReadonlyMap<string, Look> {
  const key = `${day}|${names.join(",")}`;
  if (key === last.key) return last.looks;
  const present = new Set(names);
  const kept = last.seats.filter((name) => present.has(name));
  const seats = [...kept, ...names.filter((name) => !kept.includes(name))];
  last = { key, seats, looks: looksOf(seats, day, last.looks) };
  return last.looks;
}

// The day the crew is dealt on: one clock for every Cell, turning at midnight.
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

/** What the Cell named `name` wears in the crew in view; undefined for a Cell the workspace doesn't show. */
export function useRosterLook(name: string | undefined): readonly string[] | undefined {
  const crew = useWorkspaceStore((store) => crewOf(store.workspace).join(","));
  const day = useSyncExternalStore(subscribe, () => today);
  if (name === undefined || crew === "") return undefined;
  return dealRoster(crew.split(","), day).get(name)?.worn;
}
