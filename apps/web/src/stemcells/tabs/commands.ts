/**
 * Workspace commands for views outside the workspace (the left column's
 * rail). The workspace provides each while it is mounted.
 */
let newCellTab: (() => void) | null = null;

/** The workspace's "New Cell" (⌘T): a new tab with a new Cell in it. */
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
