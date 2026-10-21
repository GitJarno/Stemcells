/**
 * Moves between windows: a tab torn off into a window of its own or joined
 * to another strip, a chat carried to another pane, strip or window, a
 * window closed, and any of them taken back.
 */
import { askiTabOf, isAskiTab } from "../tabs/askiTab";
import {
  activateTab,
  closePane,
  closeTab,
  insertTab,
  panesOf,
  placePane,
  type CellRef,
  type PaneSide,
  type Tab,
  type Workspace,
} from "../tabs/layout";
import {
  leadAfter,
  moved,
  samePlace,
  shapeOf,
  windowById,
  windowHoldingPane,
  windowHoldingTab,
  type Arrangement,
  type Moved,
  type Placed,
  type Rect,
} from "./arrangement";

/** A window a move opens: its id and where it lands. */
export interface NewWindow {
  readonly id: string;
  readonly frame: Rect;
  readonly display: string;
}

/** Ids for the tab, row and column a carried chat may need. */
export interface NewTabIds {
  readonly tab: string;
  readonly row: string;
  readonly column: string;
}

/** Where a tab may sit in a strip: Aski's first, every other after it. */
function slotFor(workspace: Workspace, tab: Tab, index: number): number {
  if (isAskiTab(tab)) return 0;
  return Math.max(index, askiTabOf(workspace) ? 1 : 0);
}

function withTab(workspace: Workspace, tab: Tab, index: number): Workspace {
  return activateTab(insertTab(workspace, tab, slotFor(workspace, tab, index)), tab.id);
}

function opened(window: NewWindow, tab: Tab): Placed {
  return { ...window, fullScreen: false, workspace: { tabs: [tab], activeTabId: tab.id } };
}

/**
 * Changes some windows' workspaces; a window other than `front` left with no
 * tabs closes. `front` comes forward.
 */
function change(
  arrangement: Arrangement,
  workspaces: ReadonlyMap<string, Workspace>,
  open: ReadonlyArray<Placed>,
  front: string,
): Moved {
  const changed: Placed[] = [];
  const close: string[] = [];
  for (const [id, workspace] of workspaces) {
    const window = windowById(arrangement, id)!;
    if (workspace.tabs.length === 0 && id !== front) close.push(id);
    else changed.push({ ...window, workspace });
  }
  return moved(arrangement, {
    open,
    change: changed,
    close,
    front,
    lead: leadAfter(arrangement, new Set(close), front),
    memories: arrangement.memories,
  });
}

/** Tears a tab off into a new window. A window's only tab doesn't tear: the window moves. */
export function tear(arrangement: Arrangement, tabId: string, to: NewWindow): Moved | null {
  const source = windowHoldingTab(arrangement, tabId);
  if (!source || source.workspace.tabs.length < 2 || windowById(arrangement, to.id)) return null;
  const tab = source.workspace.tabs.find((candidate) => candidate.id === tabId)!;
  return change(
    arrangement,
    new Map([[source.id, closeTab(source.workspace, tabId)]]),
    [opened(to, tab)],
    to.id,
  );
}

/** Joins a tab to another window's strip at `index`, where it becomes the active tab. */
export function join(
  arrangement: Arrangement,
  tabId: string,
  toWindowId: string,
  index: number,
): Moved | null {
  const source = windowHoldingTab(arrangement, tabId);
  const target = windowById(arrangement, toWindowId);
  if (!source || !target || source.id === target.id) return null;
  const tab = source.workspace.tabs.find((candidate) => candidate.id === tabId)!;
  return change(
    arrangement,
    new Map([
      [source.id, closeTab(source.workspace, tabId)],
      [target.id, withTab(target.workspace, tab, index)],
    ]),
    [],
    target.id,
  );
}

/** Where a carried chat goes: beside a pane, into a strip as a tab, or out as a window. */
export type CarryTarget =
  | {
      readonly kind: "pane";
      readonly anchor: string;
      readonly side: PaneSide;
      readonly column: string;
    }
  | {
      readonly kind: "strip";
      readonly window: string;
      readonly index: number;
      readonly ids: NewTabIds;
    }
  | { readonly kind: "window"; readonly window: NewWindow; readonly ids: NewTabIds };

/**
 * Carries a chat (a pane) to another place. Aski's chat stays in Aski's tab,
 * which takes no other. The only chat of a window's only tab doesn't carry
 * out into a window: that window moves.
 */
export function carry(arrangement: Arrangement, paneId: string, to: CarryTarget): Moved | null {
  const found = windowHoldingPane(arrangement, paneId);
  if (!found || isAskiTab(found.tab)) return null;
  const source = found.window;
  const workspaces = new Map([[source.id, closePane(source.workspace, paneId)]]);
  const workspaceOf = (window: Placed) => workspaces.get(window.id) ?? window.workspace;
  const tabOf = (ids: NewTabIds): Tab => ({
    id: ids.tab,
    rows: [{ id: ids.row, columns: [{ id: ids.column, panes: [found.pane] }] }],
    focusedPaneId: found.pane.id,
  });

  if (to.kind === "window") {
    const alone = source.workspace.tabs.length === 1 && panesOf(found.tab).length === 1;
    if (alone || windowById(arrangement, to.window.id)) return null;
    return change(arrangement, workspaces, [opened(to.window, tabOf(to.ids))], to.window.id);
  }
  if (to.kind === "strip") {
    const target = windowById(arrangement, to.window);
    if (!target) return null;
    workspaces.set(target.id, withTab(workspaceOf(target), tabOf(to.ids), to.index));
    return change(arrangement, workspaces, [], target.id);
  }
  const anchor = windowHoldingPane(arrangement, to.anchor);
  if (!anchor || to.anchor === paneId || isAskiTab(anchor.tab)) return null;
  workspaces.set(
    anchor.window.id,
    placePane(workspaceOf(anchor.window), found.pane, to.anchor, to.side, to.column),
  );
  return change(arrangement, workspaces, [], anchor.window.id);
}

/**
 * Closes a window and its tabs; their chats stay in the sidebar. Aski's tab
 * goes home to the lead window. The last window doesn't close here: its
 * record stays for the next window the app opens.
 */
export function closeWindow(arrangement: Arrangement, windowId: string): Moved | null {
  const window = windowById(arrangement, windowId);
  if (!window || arrangement.windows.length < 2) return null;
  const closing = new Set([windowId]);
  const lead = leadAfter(arrangement, closing, null)!;
  const aski = askiTabOf(window.workspace);
  const home = windowById(arrangement, lead)!;
  return moved(arrangement, {
    open: [],
    change: aski ? [{ ...home, workspace: insertTab(home.workspace, aski, 0) }] : [],
    close: [windowId],
    front: null,
    lead,
    memories: arrangement.memories,
  });
}

/** The chat each pane shows now: a draft sent since a move is its thread. */
function cellsNow(arrangement: Arrangement): Map<string, CellRef | null> {
  const cells = new Map<string, CellRef | null>();
  for (const window of arrangement.windows) {
    for (const tab of window.workspace.tabs) {
      for (const pane of panesOf(tab)) cells.set(pane.id, pane.cell);
    }
  }
  return cells;
}

function withCells(workspace: Workspace, cells: ReadonlyMap<string, CellRef | null>): Workspace {
  return {
    ...workspace,
    tabs: workspace.tabs.map((tab) => ({
      ...tab,
      rows: tab.rows.map((row) => ({
        ...row,
        columns: row.columns.map((column) => ({
          ...column,
          panes: column.panes.map((pane) =>
            cells.has(pane.id) ? { ...pane, cell: cells.get(pane.id)! } : pane,
          ),
        })),
      })),
    })),
  };
}

/**
 * Takes a move back, while every window it touched still holds what the move
 * left there (focus and the active tab aside). Windows return to their
 * places only where the move placed them; one moved by hand since stays put.
 */
export function undo(current: Arrangement, entry: Moved["undo"]): Moved | null {
  const { before, after } = entry;
  const shape = (window: Placed) => shapeOf(window.workspace);
  const beforeIds = new Set(before.windows.map((window) => window.id));
  const afterIds = new Set(after.windows.map((window) => window.id));
  const opened = after.windows.filter((window) => !beforeIds.has(window.id));
  const closed = before.windows.filter((window) => !afterIds.has(window.id));
  const changed = after.windows.filter((window) => {
    const was = windowById(before, window.id);
    return was !== null && (shape(was) !== shape(window) || !samePlace(was, window));
  });
  const memoriesChanged = JSON.stringify(before.memories) !== JSON.stringify(after.memories);
  if (opened.length + closed.length + changed.length === 0 && !memoriesChanged) return null;

  const unchangedSince = [...opened, ...changed].every((window) => {
    const now = windowById(current, window.id);
    return now !== null && shape(now) === shape(window);
  });
  if (!unchangedSince || closed.some((window) => windowById(current, window.id))) return null;

  const cells = cellsNow(current);
  const restore = changed.map((window): Placed => {
    const was = windowById(before, window.id)!;
    const now = windowById(current, window.id)!;
    const workspace =
      shape(was) === shape(window) ? now.workspace : withCells(was.workspace, cells);
    const place = samePlace(was, window) ? now : was;
    return {
      ...now,
      frame: place.frame,
      display: place.display,
      fullScreen: place.fullScreen,
      workspace,
    };
  });
  const closing = new Set(opened.map((window) => window.id));
  const front = before.windows[0]?.id ?? null;
  const standsAfter = (id: string | null) =>
    id !== null &&
    ((windowById(current, id) !== null && !closing.has(id)) ||
      closed.some((window) => window.id === id));
  const lead = [current.lead, before.lead].find(standsAfter) ?? leadAfter(current, closing, front);
  return moved(current, {
    open: closed.map((window) => ({ ...window, workspace: withCells(window.workspace, cells) })),
    change: restore,
    close: [...closing],
    front,
    lead,
    memories: memoriesChanged ? before.memories : current.memories,
  });
}
