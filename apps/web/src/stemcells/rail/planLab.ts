/**
 * A dev build's hands on the planned rows, until the plan's compiler calls them itself
 * (stemcells/tasks/aski-orchestrator.md, slice 3): `stemcellsPlan` in the console.
 */
import {
  clearPlannedRows,
  confirmPlannedRow,
  dropPlannedRow,
  onPlannedRowOpened,
  type PlannedRow,
  setPlannedRows,
} from "../../../../../stemcells/aski/planned.ts";
import { throwTo } from "../aski/throw";
import { opensNoTab } from "../windows/landing";

const lab = {
  /** Plans `rows` as `planId`; with `from` (an element's selector) Aski there throws a copy to each. */
  set(planId: string, rows: ReadonlyArray<PlannedRow>, from?: string) {
    const aski = from === undefined ? null : document.querySelector(from);
    const threadIds = rows.map((row) => row.threadId);
    opensNoTab(threadIds);
    if (aski) throwTo(threadIds, aski);
    setPlannedRows(planId, rows);
  },
  clear: clearPlannedRows,
  confirm: confirmPlannedRow,
  drop: dropPlannedRow,
  /** The check rows opened since the page loaded. */
  opened: [] as string[],
};
onPlannedRowOpened((row) => void lab.opened.push(row.threadId));

declare global {
  interface Window {
    stemcellsPlan?: typeof lab;
  }
}
window.stemcellsPlan = lab;
