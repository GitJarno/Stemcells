/**
 * Aski's tab: the first in the strip, always there once Aski's chat is, and
 * holding that one chat alone. It never closes, moves or splits, and a chat
 * routed to while it is focused opens in a tab of its own.
 */
import {
  activeTab,
  closeTab,
  focusedPane,
  moveTab,
  openTab,
  paneShowing,
  panesOf,
  sameChat,
  showRoute,
  splitDown,
  splitRight,
  type CellRef,
  type NewIds,
  type Tab,
  type Workspace,
} from "./layout";

export const ASKI_TAB_ID = "aski";

export function isAskiTab(tab: Tab | null | undefined): boolean {
  return tab?.id === ASKI_TAB_ID;
}

export function askiTabOf(workspace: Workspace): Tab | null {
  return workspace.tabs.find(isAskiTab) ?? null;
}

/** The chat Aski's tab shows, once it has one. */
export function askiCellOf(workspace: Workspace): CellRef | null {
  const tab = askiTabOf(workspace);
  return tab ? (panesOf(tab)[0]?.cell ?? null) : null;
}

/**
 * Puts Aski's chat in Aski's tab, first in the strip. A tab that is new
 * becomes the active one: Aski is where the app opens the first time.
 */
export function seatAski(workspace: Workspace, cell: CellRef, ids: NewIds): Workspace {
  const existing = askiTabOf(workspace);
  const panes = existing ? panesOf(existing) : [];
  const shown = panes[0]?.cell;
  const seated =
    workspace.tabs[0] === existing &&
    panes.length === 1 &&
    shown &&
    shown.threadId === cell.threadId;
  if (seated && shown.environmentId === cell.environmentId && shown.draftId === cell.draftId) {
    return workspace;
  }
  const paneId = panes[0]?.id ?? ids.pane;
  const row = existing?.rows[0];
  const tab: Tab = {
    id: ASKI_TAB_ID,
    rows: [
      {
        id: row?.id ?? ids.row,
        columns: [{ id: row?.columns[0]?.id ?? ids.column, panes: [{ id: paneId, cell }] }],
      },
    ],
    focusedPaneId: paneId,
  };
  const others = workspace.tabs.filter((candidate) => !isAskiTab(candidate));
  return {
    tabs: [tab, ...others],
    activeTabId: existing ? workspace.activeTabId : ASKI_TAB_ID,
  };
}

/**
 * The route's chat, shown as `showRoute` would, except that Aski's pane
 * only ever shows Aski: another chat routed to while it is focused opens in
 * the pane already showing it, else in a new tab.
 */
export function showRouteBesideAski(workspace: Workspace, cell: CellRef, ids: NewIds): Workspace {
  const askiCell = askiCellOf(workspace);
  const inAskiTab = isAskiTab(activeTab(workspace)) && focusedPane(workspace) !== null;
  if (!inAskiTab || (askiCell && sameChat(askiCell, cell)) || paneShowing(workspace, cell)) {
    return showRoute(workspace, cell, ids);
  }
  return openTab(workspace, ids, cell);
}

export function closeTabUnlessAski(workspace: Workspace, tabId: string): Workspace {
  return tabId === ASKI_TAB_ID ? workspace : closeTab(workspace, tabId);
}

/** Moves a Cell's tab among the Cells' tabs; Aski's stays first. */
export function moveTabAfterAski(workspace: Workspace, tabId: string, toIndex: number): Workspace {
  if (tabId === ASKI_TAB_ID) return workspace;
  const floor = askiTabOf(workspace) ? 1 : 0;
  return moveTab(workspace, tabId, Math.max(floor, toIndex));
}

export function splitRightOutsideAski(
  workspace: Workspace,
  ids: NewIds,
  rowWidth: number,
): Workspace {
  return isAskiTab(activeTab(workspace)) ? workspace : splitRight(workspace, ids, rowWidth);
}

export function splitDownOutsideAski(workspace: Workspace, ids: NewIds): Workspace {
  return isAskiTab(activeTab(workspace)) ? workspace : splitDown(workspace, ids);
}
