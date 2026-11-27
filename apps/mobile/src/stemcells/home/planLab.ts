// A dev build's hands on the planned rows, until the plan's compiler calls them itself
// (stemcells/tasks/aski-orchestrator.md, slice 3): `stemcellsPlan` in the debugger's console.

import {
  clearPlannedRows,
  confirmPlannedRow,
  dropPlannedRow,
  onPlannedRowOpened,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
import { throwTo } from "./plannedArrivals";

const lab = {
  /** Plans `rows` as `planId`; Aski, where it stands, throws a copy to each. */
  set(planId: string, rows: ReadonlyArray<PlannedRow>) {
    throwTo(rows.map((row) => row.threadId));
    setPlannedRows(planId, rows);
  },
  clear: clearPlannedRows,
  confirm: confirmPlannedRow,
  drop: dropPlannedRow,
  /** The check rows opened since the app loaded. */
  opened: [] as string[],
};
onPlannedRowOpened((row) => void lab.opened.push(row.threadId));

(globalThis as { stemcellsPlan?: typeof lab }).stemcellsPlan = lab;
