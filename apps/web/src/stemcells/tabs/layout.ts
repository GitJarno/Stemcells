/**
 * Tabs and panes for the chat area, as plain data. A tab is rows of columns,
 * each column a stack of panes, and each pane shows one Cell (a chat). Every
 * change is a pure function from one workspace to the next.
 */

import { NAME_MAX_LENGTH } from "../rename/limits";
import { sharePair } from "../split/split";

/** The chat a pane shows. A draft and the thread it becomes share `threadId`. */
export interface CellRef {
  readonly environmentId: string;
  readonly threadId: string;
  /** Set while the chat is an unsent draft, whose route names the draft. */
  readonly draftId: string | null;
}

/**
 * A pane, column or row's share of its parent's height or width, against
 * its siblings' (`shareOf`). Unset, it takes an even share: a newcomer
 * shares its parent evenly, and the others keep theirs to each other.
 */
interface Shared {
  readonly share?: number;
}

export interface Pane extends Shared {
  readonly id: string;
  /** Null while a new Cell is being opened into it. */
  readonly cell: CellRef | null;
}

export interface Column extends Shared {
  readonly id: string;
  readonly panes: ReadonlyArray<Pane>;
}

export interface Row extends Shared {
  readonly id: string;
  readonly columns: ReadonlyArray<Column>;
}

export interface Tab {
  readonly id: string;
  readonly rows: ReadonlyArray<Row>;
  readonly focusedPaneId: string;
  /**
   * The name a person gave the tab, shown while it holds more than one Cell.
   * Without one, or holding one Cell, the tab is named by its focused chat.
   */
  readonly name?: string;
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

/**
 * The shortest a pane gets when a border is dragged: its buttons' band, a
 * line of its chat, and its composer under the line that names its Cell
 * (measured at about 200 px together, the buttons then on the line).
 */
export const MIN_PANE_HEIGHT = 240;

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

/**
 * Each child's share of its parent, in order, at a mean of 1: its own, or, unset, the mean of its
 * siblings' shares, so a newcomer takes an even share. Read at a mean of 1, children always fill
 * their parent: a column closed or carried away leaves its siblings' shares summing under 1, and
 * a flex parent fills only that part of itself.
 */
export function sharesOf(children: ReadonlyArray<Shared>): number[] {
  const set = children.flatMap((child) => child.share ?? []);
  const even = set.length > 0 ? set.reduce((sum, share) => sum + share, 0) / set.length : 1;
  const shares = children.map((child) => child.share ?? even);
  const mean = shares.reduce((sum, share) => sum + share, 0) / Math.max(1, shares.length);
  return shares.map((share) => share / mean);
}

/** A pane arriving somewhere new: it takes an even share there, not the one it had. */
export function arriving(pane: Pane): Pane {
  const { share: _left, ...fresh } = pane;
  return fresh;
}

function withShares<T extends Shared>(children: ReadonlyArray<T>, shares: number[]): T[] {
  // Kept to a mean of 1, so an even share is 1 whatever was dragged before.
  const total = shares.reduce((sum, share) => sum + share, 0);
  return children.map((child, index) => ({
    ...child,
    share: (shares[index]! * children.length) / total,
  }));
}

/** A tab's rows, a row's columns or a column's panes, by the parent's id. */
function childrenOf(tab: Tab, parentId: string): ReadonlyArray<Shared> | null {
  if (tab.id === parentId) return tab.rows;
  for (const row of tab.rows) {
    if (row.id === parentId) return row.columns;
    const column = row.columns.find((candidate) => candidate.id === parentId);
    if (column) return column.panes;
  }
  return null;
}

/**
 * Shares out a parent between its children, in order: a tab's rows, a
 * row's columns or a column's panes, the parent named by its id. Shares
 * that don't fit its children leave the workspace as it was.
 */
export function shareOut(workspace: Workspace, parentId: string, shares: number[]): Workspace {
  const tab = workspace.tabs.find((candidate) => childrenOf(candidate, parentId) !== null);
  const fits =
    tab !== undefined &&
    childrenOf(tab, parentId)!.length === shares.length &&
    shares.every((share) => Number.isFinite(share) && share > 0);
  if (!fits) return workspace;
  const share = <T extends Shared>(children: ReadonlyArray<T>, id: string) =>
    id === parentId ? withShares(children, shares) : children;
  const rows = share(tab.rows, tab.id).map((row) => ({
    ...row,
    columns: share(row.columns, row.id).map((column) => ({
      ...column,
      panes: share(column.panes, column.id),
    })),
  }));
  return replaceTab(workspace, { ...tab, rows });
}

/**
 * A border dragged: the children at `index` and `index + 1` of a parent
 * share what they had between them as `before` to `after`.
 */
export function resizePair(
  workspace: Workspace,
  parentId: string,
  index: number,
  before: number,
  after: number,
): Workspace {
  const children = workspace.tabs.map((tab) => childrenOf(tab, parentId)).find(Boolean);
  if (!children || index < 0 || index + 1 >= children.length) return workspace;
  return shareOut(workspace, parentId, sharePair(sharesOf(children), index, before, after));
}

/** A parent's children, evened out. */
export function evenOut(workspace: Workspace, parentId: string): Workspace {
  const children = workspace.tabs.map((tab) => childrenOf(tab, parentId)).find(Boolean);
  return children
    ? shareOut(
        workspace,
        parentId,
        children.map(() => 1),
      )
    : workspace;
}

/**
 * The shortest a row gets: its tallest stack of panes, each at its
 * shortest.
 */
export function rowFloor(row: Row): number {
  return Math.max(...row.columns.map((column) => column.panes.length)) * MIN_PANE_HEIGHT;
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

/** A name as a tab keeps it: trimmed, and no longer than NAME_MAX_LENGTH. */
function tabName(name: string): string {
  return name.trim().slice(0, NAME_MAX_LENGTH).trim();
}

/** Names a tab; a blank name gives it back the name of its focused chat. */
export function nameTab(workspace: Workspace, tabId: string, name: string | null): Workspace {
  const given = tabName(name ?? "");
  return {
    ...workspace,
    tabs: workspace.tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      if (given.length > 0) return { ...tab, name: given };
      const { name: _given, ...unnamed } = tab;
      return unnamed;
    }),
  };
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
 * The row's columns' shares with a newcomer `width` wide after the column at
 * `index` (-1: first), as the row lays them out `rowWidth` wide: the others give it
 * room in proportion to what each has over MIN_COLUMN_WIDTH, so none goes
 * under it; null when they haven't that much room between them.
 */
function sharesBeside(
  columns: ReadonlyArray<Column>,
  index: number,
  rowWidth: number,
  width: number,
): number[] | null {
  const widths = sharesOf(columns).map((share) => (rowWidth * share) / columns.length);
  const spare = widths.map((each) => Math.max(0, each - MIN_COLUMN_WIDTH));
  const room = spare.reduce((sum, each) => sum + each, 0);
  if (width < MIN_COLUMN_WIDTH || room < width) return null;
  const kept = widths.map((each, at) => each - (width * spare[at]!) / room);
  kept.splice(index + 1, 0, width);
  return kept;
}

/** The focused pane's row, and its column's index in it. */
function focusedColumn(tab: Tab): { row: Row; index: number } | null {
  for (const row of tab.rows) {
    const index = row.columns.findIndex((column) =>
      column.panes.some((candidate) => candidate.id === tab.focusedPaneId),
    );
    if (index >= 0) return { row, index };
  }
  return null;
}

/**
 * Adds an empty pane beside the focused one, in a new column as wide as an
 * even share of the row; the other columns give it room as they have it
 * over MIN_COLUMN_WIDTH (`sharesBeside`). When they haven't the room, the
 * newcomer starts a new row under the focused one.
 */
export function splitRight(workspace: Workspace, ids: NewIds, rowWidth: number): Workspace {
  const tab = activeTab(workspace);
  const focused = tab ? focusedColumn(tab) : null;
  if (!tab || !focused) return workspace;
  const pane: Pane = { id: ids.pane, cell: null };
  const { row, index } = focused;
  const width = rowWidth / (row.columns.length + 1);
  const shares = sharesBeside(row.columns, index, rowWidth, width);
  const rows = tab.rows.flatMap((candidate): Row[] => {
    if (candidate !== row) return [candidate];
    if (shares === null) {
      return [row, { id: ids.row, columns: [{ id: ids.column, panes: [pane] }] }];
    }
    const columns = [...row.columns];
    columns.splice(index + 1, 0, { id: ids.column, panes: [pane] });
    return [{ ...row, columns: withShares(columns, shares) }];
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
  const width = rowWidth / (row.columns.length + 1);
  const fitsBeside =
    width >= CELL_COLUMN_WIDTH &&
    sharesBeside(row.columns, row.columns.indexOf(column), rowWidth, width) !== null;
  return column.panes.length > 1 || !fitsBeside
    ? splitDown(workspace, ids)
    : splitRight(workspace, ids, rowWidth);
}

/**
 * Adds a pane at the end of a tab, the way `addPane` adds one after the
 * focused pane, from the tab's last pane instead: the tab may not be on
 * stage, and its end is the place the person can predict without seeing
 * it. The stage and the tab's focus stay as they were.
 */
export function joinTab(
  workspace: Workspace,
  tabId: string,
  pane: Pane,
  columnId: string,
  rowWidth: number,
): Workspace {
  const tab = workspace.tabs.find((candidate) => candidate.id === tabId);
  const last = tab ? panesOf(tab).at(-1) : undefined;
  if (!tab || !last || findPane(workspace, (candidate) => candidate.id === pane.id)) {
    return workspace;
  }
  const holdsLast = (column: Column) => column.panes.some((candidate) => candidate.id === last.id);
  const row = tab.rows.find((candidate) => candidate.columns.some(holdsLast))!;
  const column = row.columns.find(holdsLast)!;
  const width = rowWidth / (row.columns.length + 1);
  const fitsBeside =
    column.panes.length === 1 &&
    width >= CELL_COLUMN_WIDTH &&
    sharesBeside(row.columns, row.columns.indexOf(column), rowWidth, width) !== null;
  const placed = placePane(
    workspace,
    pane,
    last.id,
    fitsBeside ? "right" : "below",
    columnId,
    rowWidth,
  );
  const joined = placed.tabs.find((candidate) => candidate.id === tabId)!;
  return {
    ...replaceTab(placed, { ...joined, focusedPaneId: tab.focusedPaneId }),
    activeTabId: workspace.activeTabId,
  };
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

/** Places a chat no pane shows, leaving every pane's chat where it is. */
export type Land = (workspace: Workspace, cell: CellRef, ids: NewIds) => Workspace;

const ownTab: Land = (workspace, cell, ids) => openTab(workspace, ids, cell);

/**
 * The URL names the chat the user went to. A pane showing it takes focus; an empty focused pane
 * shows it; otherwise `land` places and focuses it, never taking the chat being read off its pane
 * (stemcells/tasks/left-column.md, decision 9). A sent draft arrives as its thread (same id) and
 * updates its pane in place, without taking focus when that pane isn't focused.
 */
export function showRoute(
  workspace: Workspace,
  cell: CellRef,
  ids: NewIds,
  land: Land = ownTab,
): Workspace {
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
  if (focused.cell === null) return dropStrayEmptyPanes(setCell(workspace, focused.id, cell));
  const landed = land(workspace, cell, ids);
  const placed = paneShowing(landed, cell) ? landed : ownTab(workspace, cell, ids);
  const pane = paneShowing(placed, cell)?.pane;
  return pane ? dropStrayEmptyPanes(focusPane(placed, pane.id)) : placed;
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

/** A kept share; any other value is no share, an even one. */
function parseShare(value: unknown): Shared {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? { share: value } : {};
}

function parsePane(value: unknown): Pane | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const cell = parseCell(value.cell);
  return cell ? { id: value.id, cell, ...parseShare(value.share) } : null;
}

function parseColumn(value: unknown): Column | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const panes = parseList(value.panes, parsePane);
  return panes ? { id: value.id, panes, ...parseShare(value.share) } : null;
}

function parseRow(value: unknown): Row | null {
  if (!isRecord(value) || !isNonEmptyString(value.id)) return null;
  const columns = parseList(value.columns, parseColumn);
  return columns ? { id: value.id, columns, ...parseShare(value.share) } : null;
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
  const name = typeof value.name === "string" ? tabName(value.name) : "";
  return name.length > 0 ? { ...tab, focusedPaneId, name } : { ...tab, focusedPaneId };
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

// Moves between windows (stemcells/windows): a tab or a pane arriving from
// another window keeps its ids, because upstream files a draft under its
// pane's id.

/** Puts a tab at `index` in the strip, clamped; the first tab becomes the active one. */
export function insertTab(workspace: Workspace, tab: Tab, index: number): Workspace {
  const tabs = workspace.tabs.filter((candidate) => candidate.id !== tab.id);
  tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, tab);
  return { tabs, activeTabId: workspace.activeTabId ?? tab.id };
}

/** Where a pane lands on another: the half of it the hand is over. */
export type PaneSide = "left" | "right" | "above" | "below";

/**
 * Puts a pane beside `anchorId` in a new column of its row (left, right), or in its column
 * (above, below). A new column takes an even share of the row, the others giving room as ⌘D's do
 * (`sharesBeside`); without the room, it stacks in the anchor's column, over it for left and
 * under it for right. The pane takes focus and its tab becomes active.
 */
export function placePane(
  workspace: Workspace,
  pane: Pane,
  anchorId: string,
  side: PaneSide,
  columnId: string,
  rowWidth: number,
): Workspace {
  const found = findPane(workspace, (candidate) => candidate.id === anchorId);
  if (!found || findPane(workspace, (candidate) => candidate.id === pane.id)) return workspace;
  const holdsAnchor = (column: Column) => column.panes.some((p) => p.id === anchorId);
  const stack = (row: Row, before: boolean): Row => ({
    ...row,
    columns: row.columns.map((column) => {
      const index = column.panes.findIndex((p) => p.id === anchorId);
      if (index < 0) return column;
      const panes = [...column.panes];
      panes.splice(index + (before ? 0 : 1), 0, arriving(pane));
      return { ...column, panes };
    }),
  });
  const rows = found.tab.rows.map((row) => {
    const columnIndex = row.columns.findIndex(holdsAnchor);
    if (columnIndex < 0) return row;
    if (side === "above" || side === "below") return stack(row, side === "above");
    const at = columnIndex + (side === "right" ? 1 : 0);
    const width = rowWidth / (row.columns.length + 1);
    const shares = sharesBeside(row.columns, at - 1, rowWidth, width);
    if (shares === null) return stack(row, side === "left");
    const columns = [...row.columns];
    columns.splice(at, 0, { id: columnId, panes: [arriving(pane)] });
    return { ...row, columns: withShares(columns, shares) };
  });
  const placed = replaceTab(workspace, { ...found.tab, rows, focusedPaneId: pane.id });
  return { ...placed, activeTabId: found.tab.id };
}
