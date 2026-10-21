/**
 * Tabs and panes for the chat area, as plain data. A tab is rows of columns,
 * each column a stack of panes, and each pane shows one Cell (a chat). Every
 * change is a pure function from one workspace to the next.
 */

/** The chat a pane shows. A draft and the thread it becomes share `threadId`. */
export interface CellRef {
  readonly environmentId: string;
  readonly threadId: string;
  /** Set while the chat is an unsent draft, whose route names the draft. */
  readonly draftId: string | null;
}

export interface Pane {
  readonly id: string;
  /** Null while a new Cell is being opened into it. */
  readonly cell: CellRef | null;
}

export interface Column {
  readonly id: string;
  readonly panes: ReadonlyArray<Pane>;
}

export interface Row {
  readonly id: string;
  readonly columns: ReadonlyArray<Column>;
}

export interface Tab {
  readonly id: string;
  readonly rows: ReadonlyArray<Row>;
  readonly focusedPaneId: string;
}

export interface Workspace {
  readonly tabs: ReadonlyArray<Tab>;
  readonly activeTabId: string | null;
}

export const EMPTY_WORKSPACE: Workspace = { tabs: [], activeTabId: null };

/** Narrower than this, a new column starts a new row instead. */
export const MIN_COLUMN_WIDTH = 160;

/**
 * The narrowest a column gets when Cells open beside each other: the narrow
 * pane a chat is made to read at (stemcells/tasks/narrow-panes.md).
 */
export const CELL_COLUMN_WIDTH = 300;

/** Fresh ids for whatever an action may create. */
export interface NewIds {
  readonly tab: string;
  readonly row: string;
  readonly column: string;
  readonly pane: string;
}

export function sameChat(left: CellRef, right: CellRef): boolean {
  return left.environmentId === right.environmentId && left.threadId === right.threadId;
}

export function panesOf(tab: Tab): Pane[] {
  return tab.rows.flatMap((row) => row.columns.flatMap((column) => column.panes));
}

export function activeTab(workspace: Workspace): Tab | null {
  return workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? null;
}

export function focusedPane(workspace: Workspace): Pane | null {
  const tab = activeTab(workspace);
  if (!tab) return null;
  return panesOf(tab).find((pane) => pane.id === tab.focusedPaneId) ?? null;
}

export function findPane(
  workspace: Workspace,
  predicate: (pane: Pane) => boolean,
): { tab: Tab; pane: Pane } | null {
  for (const tab of workspace.tabs) {
    const pane = panesOf(tab).find(predicate);
    if (pane) return { tab, pane };
  }
  return null;
}

export function paneShowing(workspace: Workspace, cell: CellRef): { tab: Tab; pane: Pane } | null {
  return findPane(workspace, (pane) => pane.cell !== null && sameChat(pane.cell, cell));
}

function newTab(ids: NewIds, cell: CellRef | null): Tab {
  return {
    id: ids.tab,
    rows: [{ id: ids.row, columns: [{ id: ids.column, panes: [{ id: ids.pane, cell }] }] }],
    focusedPaneId: ids.pane,
  };
}

function replaceTab(workspace: Workspace, next: Tab): Workspace {
  return { ...workspace, tabs: workspace.tabs.map((tab) => (tab.id === next.id ? next : tab)) };
}

function mapPanes(tab: Tab, map: (pane: Pane) => Pane): Tab {
  return {
    ...tab,
    rows: tab.rows.map((row) => ({
      ...row,
      columns: row.columns.map((column) => ({ ...column, panes: column.panes.map(map) })),
    })),
  };
}

/** Opens a tab at the end of the strip and makes it active. */
export function openTab(workspace: Workspace, ids: NewIds, cell: CellRef | null): Workspace {
  return { tabs: [...workspace.tabs, newTab(ids, cell)], activeTabId: ids.tab };
}

export function activateTab(workspace: Workspace, tabId: string): Workspace {
  if (workspace.activeTabId === tabId) return workspace;
  if (!workspace.tabs.some((tab) => tab.id === tabId)) return workspace;
  return { ...workspace, activeTabId: tabId };
}

/** Closing the active tab activates its right neighbour, else its left. */
export function closeTab(workspace: Workspace, tabId: string): Workspace {
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return workspace;
  const tabs = workspace.tabs.filter((tab) => tab.id !== tabId);
  if (workspace.activeTabId !== tabId) return { ...workspace, tabs };
  const next = tabs[index] ?? tabs[index - 1] ?? null;
  return { tabs, activeTabId: next?.id ?? null };
}

export function moveTab(workspace: Workspace, tabId: string, toIndex: number): Workspace {
  const from = workspace.tabs.findIndex((tab) => tab.id === tabId);
  if (from < 0) return workspace;
  const to = Math.max(0, Math.min(toIndex, workspace.tabs.length - 1));
  if (from === to) return workspace;
  const tabs = [...workspace.tabs];
  const [moved] = tabs.splice(from, 1);
  if (moved) tabs.splice(to, 0, moved);
  return { ...workspace, tabs };
}

/** Focuses a pane in any tab, making its tab active. */
export function focusPane(workspace: Workspace, paneId: string): Workspace {
  if (focusedPane(workspace)?.id === paneId) return workspace;
  const found = findPane(workspace, (pane) => pane.id === paneId);
  if (!found) return workspace;
  const focused = replaceTab(workspace, { ...found.tab, focusedPaneId: paneId });
  return { ...focused, activeTabId: found.tab.id };
}

export function setCell(workspace: Workspace, paneId: string, cell: CellRef | null): Workspace {
  const found = findPane(workspace, (pane) => pane.id === paneId);
  if (!found) return workspace;
  return replaceTab(
    workspace,
    mapPanes(found.tab, (pane) => (pane.id === paneId ? { ...pane, cell } : pane)),
  );
}

/**
 * Adds an empty pane beside the focused one, in a new column. Columns share
 * the row's width equally; when that would make them narrower than
 * MIN_COLUMN_WIDTH, the newcomer starts a new row under the focused one.
 */
export function splitRight(workspace: Workspace, ids: NewIds, rowWidth: number): Workspace {
  const tab = activeTab(workspace);
  if (!tab) return workspace;
  const pane: Pane = { id: ids.pane, cell: null };
  const rows = tab.rows.flatMap((row): Row[] => {
    const columnIndex = row.columns.findIndex((column) =>
      column.panes.some((candidate) => candidate.id === tab.focusedPaneId),
    );
    if (columnIndex < 0) return [row];
    if (rowWidth / (row.columns.length + 1) < MIN_COLUMN_WIDTH) {
      return [row, { id: ids.row, columns: [{ id: ids.column, panes: [pane] }] }];
    }
    const columns = [...row.columns];
    columns.splice(columnIndex + 1, 0, { id: ids.column, panes: [pane] });
    return [{ ...row, columns }];
  });
  return replaceTab(workspace, { ...tab, rows, focusedPaneId: pane.id });
}

/** Adds an empty pane under the focused one, in the same column. */
export function splitDown(workspace: Workspace, ids: NewIds): Workspace {
  const tab = activeTab(workspace);
  if (!tab) return workspace;
  const pane: Pane = { id: ids.pane, cell: null };
  const rows = tab.rows.map((row) => ({
    ...row,
    columns: row.columns.map((column) => {
      const index = column.panes.findIndex((candidate) => candidate.id === tab.focusedPaneId);
      if (index < 0) return column;
      const panes = [...column.panes];
      panes.splice(index + 1, 0, pane);
      return { ...column, panes };
    }),
  }));
  return replaceTab(workspace, { ...tab, rows, focusedPaneId: pane.id });
}

/**
 * Adds an empty pane after the focused one, the way the tab holds its panes:
 * under it when its column is a stack, else beside it. Where one more column
 * would leave the row's columns narrower than CELL_COLUMN_WIDTH, it goes
 * under instead.
 */
export function addPane(workspace: Workspace, ids: NewIds, rowWidth: number): Workspace {
  const tab = activeTab(workspace);
  if (!tab) return workspace;
  const holdsFocus = (column: Column) => column.panes.some((pane) => pane.id === tab.focusedPaneId);
  const row = tab.rows.find((candidate) => candidate.columns.some(holdsFocus));
  const column = row?.columns.find(holdsFocus);
  if (!row || !column) return workspace;
  const fitsBeside = rowWidth / (row.columns.length + 1) >= CELL_COLUMN_WIDTH;
  return column.panes.length > 1 || !fitsBeside
    ? splitDown(workspace, ids)
    : splitRight(workspace, ids, rowWidth);
}

/**
 * Removes a pane. Focus moves to the pane before it in reading order (rows,
 * then columns, then top to bottom), or after it when it was first. A tab
 * left without panes closes.
 */
export function closePane(workspace: Workspace, paneId: string): Workspace {
  const found = findPane(workspace, (pane) => pane.id === paneId);
  if (!found) return workspace;
  const order = panesOf(found.tab);
  if (order.length === 1) return closeTab(workspace, found.tab.id);
  const index = order.findIndex((pane) => pane.id === paneId);
  const rows = found.tab.rows
    .map((row) => ({
      ...row,
      columns: row.columns
        .map((column) => ({
          ...column,
          panes: column.panes.filter((pane) => pane.id !== paneId),
        }))
        .filter((column) => column.panes.length > 0),
    }))
    .filter((row) => row.columns.length > 0);
  const focusedPaneId =
    found.tab.focusedPaneId === paneId
      ? (order[index - 1] ?? order[index + 1])!.id
      : found.tab.focusedPaneId;
  return replaceTab(workspace, { ...found.tab, rows, focusedPaneId });
}

/**
 * An empty pane exists only while a new Cell opens into it, as the focused
 * pane. Once a route has filled another pane instead, nothing will fill it,
 * so it goes.
 */
function dropStrayEmptyPanes(workspace: Workspace): Workspace {
  const focused = focusedPane(workspace);
  let next = workspace;
  for (const tab of workspace.tabs) {
    for (const pane of panesOf(tab)) {
      if (pane.cell === null && pane.id !== focused?.id) next = closePane(next, pane.id);
    }
  }
  return next;
}

/**
 * The URL names the chat the user went to. A pane already showing it takes
 * focus; otherwise the focused pane shows it. Draft and thread share an id,
 * so a draft that was sent arrives as its thread and updates its pane in
 * place. When that pane isn't focused (the send finished after the user
 * moved on), it updates without taking focus.
 */
export function showRoute(workspace: Workspace, cell: CellRef, ids: NewIds): Workspace {
  const holder = paneShowing(workspace, cell);
  if (holder) {
    const updated = setCell(workspace, holder.pane.id, cell);
    const holderIsFocused = focusedPane(workspace)?.id === holder.pane.id;
    const sentInBackground =
      !holderIsFocused && holder.pane.cell?.draftId != null && cell.draftId === null;
    if (holderIsFocused || sentInBackground) return updated;
    return dropStrayEmptyPanes(focusPane(updated, holder.pane.id));
  }
  const focused = focusedPane(workspace);
  if (!focused) return openTab(workspace, ids, cell);
  return dropStrayEmptyPanes(setCell(workspace, focused.id, cell));
}

// Persistence. Only whole Cells are kept: an empty pane is mid-opening and
// would come back as a pane nothing fills.

const STORAGE_VERSION = 1;

export function serializeWorkspace(workspace: Workspace): unknown {
  const tabs = workspace.tabs.flatMap((tab) => {
    const rows = tab.rows
      .map((row) => ({
        ...row,
        columns: row.columns
          .map((column) => ({ ...column, panes: column.panes.filter((pane) => pane.cell) }))
          .filter((column) => column.panes.length > 0),
      }))
      .filter((row) => row.columns.length > 0);
    if (rows.length === 0) return [];
    const kept: Tab = { ...tab, rows };
    const focusKept = panesOf(kept).some((pane) => pane.id === tab.focusedPaneId);
    return [focusKept ? kept : { ...kept, focusedPaneId: panesOf(kept)[0]!.id }];
  });
  const activeTabId = tabs.some((tab) => tab.id === workspace.activeTabId)
    ? workspace.activeTabId
    : (tabs[0]?.id ?? null);
  return { version: STORAGE_VERSION, tabs, activeTabId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseCell(value: unknown): CellRef | null {
  if (!isRecord(value)) return null;
  const { environmentId, threadId, draftId } = value;
  if (!isNonEmptyString(environmentId) || !isNonEmptyString(threadId)) return null;
  if (draftId !== null && !isNonEmptyString(draftId)) return null;
  return { environmentId, threadId, draftId };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parse);
  return items.every((item) => item !== null) && items.length > 0 ? (items as T[]) : null;
}

function parsePane(value: unknown): Pane | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const cell = parseCell(value.cell);
  return cell ? { id: value.id, cell } : null;
}

function parseColumn(value: unknown): Column | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const panes = parseList(value.panes, parsePane);
  return panes ? { id: value.id, panes } : null;
}

function parseRow(value: unknown): Row | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const columns = parseList(value.columns, parseColumn);
  return columns ? { id: value.id, columns } : null;
}

function parseTab(value: unknown): Tab | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const rows = parseList(value.rows, parseRow);
  if (!rows) return null;
  const tab: Tab = { id: value.id, rows, focusedPaneId: "" };
  const panes = panesOf(tab);
  const focusedPaneId = panes.some((pane) => pane.id === value.focusedPaneId)
    ? (value.focusedPaneId as string)
    : panes[0]!.id;
  return { ...tab, focusedPaneId };
}

/** Reads what `serializeWorkspace` wrote; anything else is an empty workspace. */
export function parseWorkspace(value: unknown): Workspace {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return EMPTY_WORKSPACE;
  const tabs = parseList(value.tabs, parseTab);
  if (!tabs) return EMPTY_WORKSPACE;
  const activeTabId = tabs.some((tab) => tab.id === value.activeTabId)
    ? (value.activeTabId as string)
    : tabs[0]!.id;
  return { tabs, activeTabId };
}
