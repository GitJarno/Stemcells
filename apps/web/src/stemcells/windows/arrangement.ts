/**
 * The app's windows as plain data: each window's place on the screen and the
 * tabs it holds. Every move between windows is a pure function from one
 * arrangement to the next, and returns the transaction that takes the
 * windows there (stemcells/tasks/windows.md, "The model").
 */
import { isAskiTab } from "../tabs/askiTab";
import { panesOf, type Pane, type Tab, type Workspace } from "../tabs/layout";

/** Screen points, the way the desktop app measures windows and displays. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Display {
  /** Stable for one monitor at one size and scale, made by the desktop app. */
  readonly key: string;
  readonly bounds: Rect;
  /** The bounds less the menu bar and the Dock. */
  readonly workArea: Rect;
}

export interface Placed {
  readonly id: string;
  /** The window's outer frame. */
  readonly frame: Rect;
  /** The display holding the frame's centre, as it was last seen. */
  readonly display: string;
  readonly fullScreen: boolean;
  readonly workspace: Workspace;
}

/** Where a window was when the windows were gathered, by tab id. */
export interface RememberedWindow {
  readonly id: string;
  readonly frame: Rect;
  readonly display: string;
  readonly fullScreen: boolean;
  readonly tabs: ReadonlyArray<string>;
  readonly activeTabId: string | null;
}

/** What Put back restores, kept for the display set it was made on. */
export interface Memory {
  readonly displays: string;
  /** The window everything was gathered into. */
  readonly home: string;
  readonly windows: ReadonlyArray<RememberedWindow>;
  /** Made by unplugging a display, and put back when it returns. */
  readonly automatic: boolean;
}

export interface Arrangement {
  /** Front to back. */
  readonly windows: ReadonlyArray<Placed>;
  /** Upstream's main window, where the app's one-per-app work runs. */
  readonly lead: string | null;
  readonly memories: ReadonlyArray<Memory>;
}

export const EMPTY_ARRANGEMENT: Arrangement = { windows: [], lead: null, memories: [] };

/**
 * What the windows do to get from one arrangement to the next. Each window
 * that changes gets its whole workspace: the desktop app refuses a
 * transaction made from a window's older state, so values are as safe as
 * edits and need no logic outside this folder to apply.
 */
export interface Transaction {
  readonly open: ReadonlyArray<Placed>;
  /** Windows that stay, with a new workspace, frame or full screen. */
  readonly change: ReadonlyArray<Placed>;
  readonly close: ReadonlyArray<string>;
  /** The window that comes forward and takes focus. */
  readonly front: string | null;
  readonly lead: string | null;
  readonly memories: ReadonlyArray<Memory>;
}

/** A move's result: where the windows end up, how they get there, and how to go back. */
export interface Moved {
  readonly next: Arrangement;
  readonly transaction: Transaction;
  readonly undo: UndoEntry;
}

/** Enough to take a move back while what it moved is still where it put it. */
export interface UndoEntry {
  readonly before: Arrangement;
  readonly after: Arrangement;
}

export function windowById(arrangement: Arrangement, id: string): Placed | null {
  return arrangement.windows.find((window) => window.id === id) ?? null;
}

export function windowHoldingTab(arrangement: Arrangement, tabId: string): Placed | null {
  return (
    arrangement.windows.find((window) => window.workspace.tabs.some((tab) => tab.id === tabId)) ??
    null
  );
}

export function windowHoldingPane(
  arrangement: Arrangement,
  paneId: string,
): { window: Placed; tab: Tab; pane: Pane } | null {
  for (const window of arrangement.windows) {
    for (const tab of window.workspace.tabs) {
      const pane = panesOf(tab).find((candidate) => candidate.id === paneId);
      if (pane) return { window, tab, pane };
    }
  }
  return null;
}

/** Left to right, then top to bottom, by each frame's top-left corner. */
export function screenOrder(windows: ReadonlyArray<Placed>): Placed[] {
  return [...windows].sort((a, b) => a.frame.x - b.frame.x || a.frame.y - b.frame.y);
}

/**
 * Every tab in one order, for a surface that has no windows (the phone):
 * the lead window's tabs, then each other window's, in screen order.
 */
export function flatTabs(arrangement: Arrangement): Tab[] {
  const lead = arrangement.windows.filter((window) => window.id === arrangement.lead);
  const others = arrangement.windows.filter((window) => window.id !== arrangement.lead);
  return [...lead, ...screenOrder(others)].flatMap((window) => window.workspace.tabs);
}

/** Aski's tab, if the strip holds it, goes first; the rest keep their order. */
export function askiFirst(tabs: ReadonlyArray<Tab>): Tab[] {
  return [...tabs.filter(isAskiTab), ...tabs.filter((tab) => !isAskiTab(tab))];
}

/**
 * The shape of a workspace: its tabs, rows, columns and panes by id, and
 * which chat each pane shows. Focus, the active tab and a draft becoming its
 * thread aren't shape: none of them makes a move's undo wrong.
 */
export function shapeOf(workspace: Workspace): string {
  return JSON.stringify(
    workspace.tabs.map((tab) => [
      tab.id,
      tab.rows.map((row) => [
        row.id,
        row.columns.map((column) => [
          column.id,
          column.panes.map((pane) => [pane.id, pane.cell?.environmentId, pane.cell?.threadId]),
        ]),
      ]),
    ]),
  );
}

function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

type Place = Pick<Placed, "frame" | "fullScreen">;

export function samePlace(a: Place, b: Place): boolean {
  return sameRect(a.frame, b.frame) && a.fullScreen === b.fullScreen;
}

/** The display holding the frame's centre, else the one it overlaps most, else the first. */
export function displayOf(frame: Rect, displays: ReadonlyArray<Display>): Display | null {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const holding = displays.find(
    ({ bounds }) =>
      cx >= bounds.x &&
      cx < bounds.x + bounds.width &&
      cy >= bounds.y &&
      cy < bounds.y + bounds.height,
  );
  if (holding) return holding;
  const overlap = (bounds: Rect) =>
    Math.max(
      0,
      Math.min(frame.x + frame.width, bounds.x + bounds.width) - Math.max(frame.x, bounds.x),
    ) *
    Math.max(
      0,
      Math.min(frame.y + frame.height, bounds.y + bounds.height) - Math.max(frame.y, bounds.y),
    );
  let best: Display | null = displays[0] ?? null;
  for (const display of displays) {
    if (overlap(display.bounds) > (best ? overlap(best.bounds) : 0)) best = display;
  }
  return best;
}

/** One key for the displays connected together, whatever order they're listed in. */
export function displaySetKey(displays: ReadonlyArray<Display>): string {
  return displays
    .map((display) => display.key)
    .toSorted()
    .join("|");
}

/** The frame moved and, if it must, shrunk to lie inside `area`. */
export function clampFrame(frame: Rect, area: Rect): Rect {
  const width = Math.min(frame.width, area.width);
  const height = Math.min(frame.height, area.height);
  return {
    x: Math.max(area.x, Math.min(frame.x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(frame.y, area.y + area.height - height)),
    width,
    height,
  };
}

/**
 * What would make the arrangement wrong, if anything: a tab, pane or chat in
 * two places, Aski's tab anywhere but first, a window with no tabs (the lead
 * may wait empty for Aski), a lead that isn't a window.
 */
export function problemsOf(arrangement: Arrangement): string[] {
  const problems: string[] = [];
  const seen = { window: new Set<string>(), tab: new Set<string>(), pane: new Set<string>() };
  const chats = new Set<string>();
  for (const window of arrangement.windows) {
    if (seen.window.has(window.id)) problems.push(`window ${window.id} twice`);
    seen.window.add(window.id);
    if (window.workspace.tabs.length === 0 && window.id !== arrangement.lead) {
      problems.push(`window ${window.id} has no tabs`);
    }
    window.workspace.tabs.forEach((tab, index) => {
      if (seen.tab.has(tab.id)) problems.push(`tab ${tab.id} twice`);
      seen.tab.add(tab.id);
      if (isAskiTab(tab) && index !== 0) problems.push(`Aski's tab is not first in ${window.id}`);
      for (const pane of panesOf(tab)) {
        if (seen.pane.has(pane.id)) problems.push(`pane ${pane.id} twice`);
        seen.pane.add(pane.id);
        if (!pane.cell) continue;
        const chat = `${pane.cell.environmentId}/${pane.cell.threadId}`;
        if (chats.has(chat)) problems.push(`chat ${chat} twice`);
        chats.add(chat);
      }
    });
  }
  if (arrangement.windows.length > 0 && !seen.window.has(arrangement.lead ?? "")) {
    problems.push("the lead is not a window");
  }
  return problems;
}

/**
 * The arrangement a transaction leads to. The front window goes first; the
 * others keep their order, and windows that open follow it in the order
 * they open.
 */
export function applyTransaction(arrangement: Arrangement, transaction: Transaction): Arrangement {
  const closing = new Set(transaction.close);
  const changes = new Map(transaction.change.map((window) => [window.id, window]));
  const kept = arrangement.windows
    .filter((window) => !closing.has(window.id))
    .map((window) => changes.get(window.id) ?? window);
  const windows = [...kept, ...transaction.open];
  const front = windows.find((window) => window.id === transaction.front);
  return {
    windows: front ? [front, ...windows.filter((window) => window !== front)] : windows,
    lead: transaction.lead,
    memories: transaction.memories,
  };
}

/**
 * The transaction that takes `before` to `after`. Applied to `before`, it
 * gives `after`, with `after`'s front window first and the others in
 * `before`'s order.
 */
export function transactionBetween(before: Arrangement, after: Arrangement): Transaction {
  const kept = new Set(before.windows.map((window) => window.id));
  const staying = new Set(after.windows.map((window) => window.id));
  const value = (window: Placed) =>
    JSON.stringify([window.frame, window.display, window.fullScreen, window.workspace]);
  const was = new Map(before.windows.map((window) => [window.id, value(window)]));
  return {
    open: after.windows.filter((window) => !kept.has(window.id)),
    change: after.windows.filter(
      (window) => kept.has(window.id) && was.get(window.id) !== value(window),
    ),
    close: before.windows.filter((window) => !staying.has(window.id)).map((window) => window.id),
    front: after.windows[0]?.id ?? null,
    lead: after.lead,
    memories: after.memories,
  };
}

/** A move from its transaction: where it leads, and the way back. */
export function moved(before: Arrangement, transaction: Transaction): Moved {
  const next = applyTransaction(before, transaction);
  return { next, transaction, undo: { before, after: next } };
}

/**
 * The lead after windows close: the same window while it stays, else the
 * front one of those left.
 */
export function leadAfter(
  arrangement: Arrangement,
  closing: ReadonlySet<string>,
  front: string | null,
): string | null {
  if (arrangement.lead !== null && !closing.has(arrangement.lead)) return arrangement.lead;
  if (front !== null && !closing.has(front)) return front;
  return arrangement.windows.find((window) => !closing.has(window.id))?.id ?? null;
}
