// The Cells a plan is starting, for the home's list before the server lists them
// (stemcells/tasks/aski-orchestrator.md, decision 12): the plan gives each row its thread id,
// so it can form at the top of Awake while its Cell comes up.

import type { PlanEntry } from "../aski/plan/trays";

/** A Cell a plan is starting, or one that waits for the person. */
export interface PlannedRow {
  readonly environmentId: string;
  readonly threadId: string;
  readonly title: string;
  /** The project's name, as the row writes it; null while none is picked. */
  readonly place: string | null;
  /** A check forms as an outline until the person starts it. */
  readonly waiting: boolean;
}

/** The rows the phone's plans stand for now: every Cell on its way or waiting. */
export function plannedRowsOf(entries: ReadonlyArray<PlanEntry>): PlannedRow[] {
  return entries.flatMap((entry) =>
    (entry.tray?.acts ?? []).flatMap((one) =>
      one.act.kind === "start" && (one.status === "starting" || one.status === "waiting")
        ? [
            {
              environmentId: entry.environmentId,
              threadId: one.act.threadId,
              title: one.act.title,
              place: one.act.place?.name ?? null,
              waiting: one.status === "waiting",
            },
          ]
        : [],
    ),
  );
}

/**
 * THE SEAM for the home's planned rows: called with the plans' Cells each time they change.
 * The home's store for rows that show before the server lists their Cell isn't built yet; when
 * it is, hand `rows` to its `setPlannedRows` here.
 */
export function feedPlannedRows(_rows: ReadonlyArray<PlannedRow>): void {}
