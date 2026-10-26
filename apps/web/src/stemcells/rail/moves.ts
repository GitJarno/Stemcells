/**
 * Which Cells moved along the column's line between two readings
 * (stemcells/tasks/left-column.md, decision 7): each one hops from where it
 * stood to its new stage's row. Pinned is a bookmark, not a stage, so it
 * takes no hops.
 */
import type { CellStanding } from "../needs/wire";
import type { ColumnStage } from "./column";

export type LineStage = Exclude<ColumnStage, "pinned">;

/** The stage each Cell in the column stands at, by its thread. */
export type Standings = ReadonlyMap<string, LineStage>;

export interface Hop {
  readonly threadId: string;
  readonly from: LineStage;
  readonly to: LineStage;
}

const STAGE: Record<CellStanding["stage"], LineStage> = {
  "needs-you": "needs",
  working: "working",
  done: "landed",
};

/** Where each Cell stands: its stage from the needs stream, else Settled when it is on that shelf. */
export function standingsOf(
  cells: ReadonlyArray<CellStanding>,
  settled: ReadonlyArray<{ readonly threadId: string }>,
): Standings {
  const standings = new Map<string, LineStage>();
  for (const cell of cells) standings.set(cell.threadId, STAGE[cell.stage]);
  for (const cell of settled) {
    if (!standings.has(cell.threadId)) standings.set(cell.threadId, "settled");
  }
  return standings;
}

/** The Cells whose stage changed; one new to the column, or gone from it, didn't hop. */
export function hopsOf(before: Standings, after: Standings): Hop[] {
  return [...after].flatMap(([threadId, to]): Hop[] => {
    const from = before.get(threadId);
    return from === undefined || from === to ? [] : [{ threadId, from, to }];
  });
}
