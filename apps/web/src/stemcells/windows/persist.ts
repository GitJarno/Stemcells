/**
 * The windows as the desktop app keeps them between launches: the
 * arrangement and the displays it was last seen on. A workspace is kept the
 * way the tab store keeps it (`serializeWorkspace`).
 */
import {
  EMPTY_WORKSPACE,
  parseWorkspace,
  serializeWorkspace,
  type Workspace,
} from "../tabs/layout";
import type { Arrangement, Display, Memory, Placed, Rect, RememberedWindow } from "./arrangement";

export interface StoredWindows {
  readonly arrangement: Arrangement;
  readonly displays: ReadonlyArray<Display>;
}

const STORAGE_VERSION = 1;

export function serializeWindows(stored: StoredWindows): unknown {
  const { arrangement, displays } = stored;
  return {
    version: STORAGE_VERSION,
    lead: arrangement.lead,
    windows: arrangement.windows.map((window) => ({
      ...window,
      workspace: serializeWorkspace(window.workspace),
    })),
    memories: arrangement.memories,
    displays,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseRect(value: unknown): Rect | null {
  if (!isRecord(value)) return null;
  const { x, y, width, height } = value;
  const finite = [x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n));
  if (!finite || (width as number) <= 0 || (height as number) <= 0) return null;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

export function parseDisplay(value: unknown): Display | null {
  if (!isRecord(value) || !isNonEmptyString(value.key)) return null;
  const bounds = parseRect(value.bounds);
  const workArea = parseRect(value.workArea);
  return bounds && workArea ? { key: value.key, bounds, workArea } : null;
}

function parsePlaced(value: unknown): Placed | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.display)) {
    return null;
  }
  const frame = parseRect(value.frame);
  if (!frame) return null;
  return {
    id: value.id,
    frame,
    display: value.display,
    fullScreen: value.fullScreen === true,
    workspace: parseWorkspace(value.workspace),
  };
}

function parseRemembered(value: unknown): RememberedWindow | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.display)) {
    return null;
  }
  const frame = parseRect(value.frame);
  if (!frame || !Array.isArray(value.tabs) || !value.tabs.every(isNonEmptyString)) return null;
  return {
    id: value.id,
    frame,
    display: value.display,
    fullScreen: value.fullScreen === true,
    tabs: value.tabs,
    activeTabId: isNonEmptyString(value.activeTabId) ? value.activeTabId : null,
  };
}

export function parseMemory(value: unknown): Memory | null {
  if (!isRecord(value) || !isNonEmptyString(value.displays) || !isNonEmptyString(value.home)) {
    return null;
  }
  if (!Array.isArray(value.windows)) return null;
  const windows = value.windows.map(parseRemembered);
  if (windows.some((window) => window === null)) return null;
  return {
    displays: value.displays,
    home: value.home,
    windows: windows as RememberedWindow[],
    automatic: value.automatic === true,
  };
}

export function parseAll<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.flatMap((item) => parse(item) ?? []) : [];
}

/**
 * Reads what `serializeWindows` wrote. Anything unreadable is dropped: a
 * window with no tabs left (unless it leads), a memory that doesn't parse, a
 * lead that isn't a window (the first one leads). Null when nothing was kept,
 * so the first window can start from the tab store's own copy.
 */
export function parseWindows(value: unknown): StoredWindows | null {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return null;
  const all = parseAll(value.windows, parsePlaced);
  const named = all.find((window) => window.id === value.lead);
  const windows = all.filter((window) => window === named || window.workspace.tabs.length > 0);
  if (windows.length === 0) return null;
  return {
    arrangement: {
      windows,
      lead: (named ?? windows[0]!).id,
      memories: parseAll(value.memories, parseMemory),
    },
    displays: parseAll(value.displays, parseDisplay),
  };
}

/** The first arrangement: one window, holding the tabs the app had before it had windows. */
export function singleWindow(
  id: string,
  frame: Rect,
  display: string,
  workspace: Workspace = EMPTY_WORKSPACE,
): Arrangement {
  return {
    windows: [{ id, frame, display, fullScreen: false, workspace }],
    lead: id,
    memories: [],
  };
}
