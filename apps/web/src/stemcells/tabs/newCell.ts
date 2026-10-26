/**
 * The new Cell past the last tab: swiping past the last tab brings a fresh page to write in.
 * Until taken it is no tab of the workspace; the pager shows its page as the strip's last. Taken,
 * it is the last tab, "bare" until sent or changed. Sending makes it a normal tab; leaving unsent
 * removes it without a trace, its draft keeping any words for next time.
 */
import {
  closeTab,
  EMPTY_WORKSPACE,
  openTab,
  panesOf,
  type CellRef,
  type NewIds,
  type Tab,
  type Workspace,
} from "./layout";

export interface NewCell {
  /** Its tab's ids, kept while its draft is: its page is the same page each time. */
  readonly ids: NewIds;
  /** Its unsent draft. */
  readonly cell: CellRef;
}

/** The new Cell's tab, as the workspace holds it once taken. */
export function newCellTab(newCell: NewCell): Tab {
  return openTab(EMPTY_WORKSPACE, newCell.ids, newCell.cell).tabs[0]!;
}

/** The new Cell's tab in the workspace, if taken. */
function takenTab(workspace: Workspace, newCell: NewCell): Tab | null {
  return workspace.tabs.find((tab) => tab.id === newCell.ids.tab) ?? null;
}

/** Whether `tab` is still just the new Cell: one pane, showing its draft. */
function bare(tab: Tab, newCell: NewCell): boolean {
  const panes = panesOf(tab);
  const cell = panes[0]?.cell;
  return (
    panes.length === 1 &&
    cell !== null &&
    cell !== undefined &&
    cell.draftId !== null &&
    cell.draftId === newCell.cell.draftId
  );
}

/** Whether the new Cell is taken: a tab of the workspace, still bare. */
export function newCellTaken(workspace: Workspace, newCell: NewCell | null): boolean {
  if (newCell === null) return false;
  const tab = takenTab(workspace, newCell);
  return tab !== null && bare(tab, newCell);
}

/**
 * Whether the new Cell's tab became a Cell's own: it was sent (`sent`, its
 * draft on its way to a thread), or changed into more than the new Cell.
 */
export function newCellKept(workspace: Workspace, newCell: NewCell, sent: boolean): boolean {
  const tab = takenTab(workspace, newCell);
  return tab !== null && (sent || !bare(tab, newCell));
}

/** Takes the new Cell: its tab goes last in the strip, and becomes the active one. */
export function takeNewCell(workspace: Workspace, newCell: NewCell): Workspace {
  if (takenTab(workspace, newCell) !== null) {
    if (workspace.activeTabId === newCell.ids.tab) return workspace;
    return { ...workspace, activeTabId: newCell.ids.tab };
  }
  return openTab(workspace, newCell.ids, newCell.cell);
}

/** Without the new Cell's tab, if it is taken and still bare. */
function withoutNewCell(workspace: Workspace, newCell: NewCell | null): Workspace {
  if (newCell === null || !newCellTaken(workspace, newCell)) return workspace;
  return closeTab(workspace, newCell.ids.tab);
}

/**
 * After any change: a bare new Cell that is no longer the active tab goes
 * (the user left it unsent). Sent or changed, it is a Cell's own tab, and
 * stays (`sent`).
 */
export function leaveNewCell(
  workspace: Workspace,
  newCell: NewCell | null,
  sent: boolean,
): Workspace {
  if (newCell === null || sent || workspace.activeTabId === newCell.ids.tab) return workspace;
  return withoutNewCell(workspace, newCell);
}

/** The workspace as stored: never with a bare new Cell, so a reload has no trace of it. */
export function storedWorkspace(
  workspace: Workspace,
  newCell: NewCell | null,
  sent: boolean,
): Workspace {
  return sent ? workspace : withoutNewCell(workspace, newCell);
}
