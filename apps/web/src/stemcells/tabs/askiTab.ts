/**
 * Aski's tab: the first in the strip, always there once Aski's chat is, and
 * holding that one chat alone. It never closes, moves or splits, and a chat
 * routed to while it is focused opens in a tab of its own.
 */
import {
  activeTab,
  addPane,
  closeTab,
  focusedPane,
  moveTab,
  openTab,
  paneShowing,
  panesOf,
  sameChat,
  setCell,
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
 * becomes the active one unless the person has `acted` since the app opened
 * (clicked, typed or swiped): Aski is where the app opens the first time,
 * even over a draft the app opened while Aski's chat was on its way, but it
 * never takes the front from a Cell the person went to or is typing in, or
 * what they wrote would go to Aski.
 */
export function seatAski(
  workspace: Workspace,
  cell: CellRef,
  ids: NewIds,
  acted = false,
): Workspace {
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
    activeTabId: existing || acted ? workspace.activeTabId : ASKI_TAB_ID,
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

/**
 * A chat opened from a link in another (a thread chip): it opens in a new
 * pane of the tab on screen, beside the pane the link was in, so the chat
 * being read stays. A chat already in a pane goes to that pane, and from
 * Aski's tab, which never splits, it gets a tab of its own.
 */
export function openBesideOutsideAski(
  workspace: Workspace,
  cell: CellRef,
  ids: NewIds,
  rowWidth: number,
): Workspace {
  const tab = activeTab(workspace);
  if (!tab || isAskiTab(tab) || paneShowing(workspace, cell)) {
    return showRouteBesideAski(workspace, cell, ids);
  }
  return setCell(addPane(workspace, ids, rowWidth), ids.pane, cell);
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

/**
 * A new Cell's pane in the tab (⌘T). Aski's tab never splits, so from there,
 * or with no tab yet, the new Cell gets a tab of its own.
 */
export function addPaneOutsideAski(workspace: Workspace, ids: NewIds, rowWidth: number): Workspace {
  const tab = activeTab(workspace);
  return tab && !isAskiTab(tab) ? addPane(workspace, ids, rowWidth) : openTab(workspace, ids, null);
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
