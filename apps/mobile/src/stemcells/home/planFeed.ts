// The Cells a plan is starting, for the home's list before the machine lists them
// (stemcells/tasks/aski-orchestrator.md, decisions 12 and 18): the plan gives each row its
// thread id, so it forms at the top of Awake while its Cell comes up, and Aski throws a copy to
// it. A Cell has no row there before the person sends it.

import {
  clearPlannedRows,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
import type { StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import type { PlanEntry } from "../aski/plan/trays";
import { placeOfKey } from "../aski/plan/world";

/** What a row says of its Cell besides the plan's own words. */
export interface RowFacts {
  readonly modelName: string;
  readonly effort?: string | undefined;
  readonly driver?: string | undefined;
}

export type FactsOf = (environmentId: string, act: StartAct, projectId: string) => RowFacts;

/** How long a plan's rows stay planned once it left: the list's own rows took over long before. */
const ROWS_KEPT_MS = 90_000;

/**
 * The rows one plan stands for now: every Cell on its way or just started here. One that waits
 * for Send or was switched off has none, and one started long ago is the list's own row.
 */
export function plannedRowsOf(entry: PlanEntry, born: number, factsOf: FactsOf): PlannedRow[] {
  return (entry.tray?.acts ?? []).flatMap((one): PlannedRow[] => {
    const { act, status } = one;
    if (act.kind !== "start" || act.place === null) return [];
    const fresh = status === "started" && one.startedAt !== undefined;
    if (status !== "starting" && !fresh) return [];
    const { place } = act;
    const projectId =
      place.projectId ?? (place.id === null ? undefined : placeOfKey(place.id)?.projectId);
    if (projectId === undefined || projectId === "") return [];
    return [
      {
        threadId: act.threadId,
        projectId,
        projectName: place.name,
        title: act.title,
        ...factsOf(entry.environmentId, act, projectId),
        born,
      },
    ];
  });
}

/** Feeds the home's planned rows from the phone's plans; `throwTo` sends Aski's copy to new ones. */
export function plannedRowsFeed(hands: {
  readonly factsOf: FactsOf;
  readonly throwTo: (threadIds: ReadonlyArray<string>) => void;
  readonly now: () => number;
  readonly later: (ms: number, run: () => void) => unknown;
}): (entries: ReadonlyArray<PlanEntry>) => void {
  const born = new Map<string, number>();
  const drawn = new Map<string, string>();
  const thrown = new Set<string>();
  return (entries) => {
    const here = new Set<string>();
    for (const entry of entries) {
      if (entry.tray === null) continue;
      here.add(entry.id);
      if (!born.has(entry.id)) born.set(entry.id, hands.now());
      const rows = plannedRowsOf(entry, born.get(entry.id)!, hands.factsOf);
      const key = JSON.stringify(rows);
      if (drawn.get(entry.id) === key) continue;
      drawn.set(entry.id, key);
      const starting = rows.filter((row) => !thrown.has(row.threadId)).map((row) => row.threadId);
      for (const threadId of starting) thrown.add(threadId);
      if (starting.length > 0) hands.throwTo(starting);
      setPlannedRows(entry.id, rows);
    }
    for (const id of drawn.keys()) {
      if (here.has(id)) continue;
      drawn.delete(id);
      born.delete(id);
      hands.later(ROWS_KEPT_MS, () => clearPlannedRows(id));
    }
  };
}
