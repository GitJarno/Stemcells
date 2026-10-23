/**
 * Workspace commands for views outside the workspace (the left column's
 * rail, a thread chip in a chat). The workspace provides each while it is
 * mounted.
 */
import type { CellRef } from "./layout";

let newCellTab: (() => void) | null = null;
let newCellPane: (() => void) | null = null;
let cellBeside: ((cell: CellRef) => void) | null = null;

/** The strip's +: a new tab with a new Cell in it. */
export function provideNewCellTab(run: () => void): () => void {
  newCellTab = run;
  return () => {
    if (newCellTab === run) newCellTab = null;
  };
}

/** Opens a new Cell in a new tab; false while no workspace is mounted. */
export function openNewCellTab(): boolean {
  if (!newCellTab) return false;
  newCellTab();
  return true;
}

/** "New Cell" (⌘T): a new Cell in a pane of the tab on screen. */
export function provideNewCellPane(run: () => void): () => void {
  newCellPane = run;
  return () => {
    if (newCellPane === run) newCellPane = null;
  };
}

/** Opens a new Cell in the tab on screen; false while no workspace is mounted. */
export function openNewCellPane(): boolean {
  if (!newCellPane) return false;
  newCellPane();
  return true;
}

/** A thread chip's click: the chat it names, in a new pane beside the one it was in. */
export function provideCellBeside(run: (cell: CellRef) => void): () => void {
  cellBeside = run;
  return () => {
    if (cellBeside === run) cellBeside = null;
  };
}

/** Opens a chat beside the one on screen; false while no workspace is mounted. */
export function openCellBeside(cell: CellRef): boolean {
  if (!cellBeside) return false;
  cellBeside(cell);
  return true;
}
