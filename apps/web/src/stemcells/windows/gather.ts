/**
 * Gather and Put back: every tab into one window, and every window back
 * where it was, remembered per display set. Unplugging a display gathers its
 * windows the same way, and plugging it back puts them back.
 */
import type { Tab, Workspace } from "../tabs/layout";
import {
  askiFirst,
  clampFrame,
  displayOf,
  displaySetKey,
  leadAfter,
  moved,
  samePlace,
  screenOrder,
  transactionBetween,
  windowById,
  type Arrangement,
  type Display,
  type Memory,
  type Moved,
  type Placed,
  type RememberedWindow,
} from "./arrangement";

function remember(window: Placed): RememberedWindow {
  return {
    id: window.id,
    frame: window.frame,
    display: window.display,
    fullScreen: window.fullScreen,
    tabs: window.workspace.tabs.map((tab) => tab.id),
    activeTabId: window.workspace.activeTabId,
  };
}

function rememberIn(memories: ReadonlyArray<Memory>, memory: Memory): Memory[] {
  return [...memories.filter((kept) => kept.displays !== memory.displays), memory];
}

/** `tabs` in a strip, active as it was if it's still there, else the first. */
function workspaceOf(tabs: ReadonlyArray<Tab>, ...active: Array<string | null>): Workspace {
  const ordered = askiFirst(tabs);
  const kept = active.find((id) => ordered.some((tab) => tab.id === id));
  return { tabs: ordered, activeTabId: kept ?? ordered[0]?.id ?? null };
}

/**
 * Every tab into `homeId`: its own first, then each other window's in screen
 * order, Aski's tab first of all. The other windows close, and where they
 * were is remembered for this display set.
 */
export function gather(arrangement: Arrangement, homeId: string, displays: string): Moved | null {
  const home = windowById(arrangement, homeId);
  if (!home || arrangement.windows.length < 2) return null;
  const others = screenOrder(arrangement.windows.filter((window) => window !== home));
  const tabs = [home, ...others].flatMap((window) => window.workspace.tabs);
  const closing = new Set(others.map((window) => window.id));
  const memory: Memory = {
    displays,
    home: homeId,
    windows: arrangement.windows.map(remember),
    automatic: false,
  };
  return moved(arrangement, {
    open: [],
    change: [{ ...home, workspace: workspaceOf(tabs, home.workspace.activeTabId) }],
    close: [...closing],
    front: homeId,
    lead: leadAfter(arrangement, closing, homeId),
    memories: rememberIn(arrangement.memories, memory),
  });
}

/**
 * Puts the windows a memory holds back where they were, each with the tabs it
 * had that still exist. A tab closed since is skipped; one opened since
 * stays where it is. The home window keeps what isn't claimed and goes back
 * to its own place, if the memory has one. The memory is spent.
 */
export function putBack(arrangement: Arrangement, memory: Memory): Moved | null {
  const home = windowById(arrangement, memory.home) ?? arrangement.windows[0];
  if (!home) return null;
  const tabs = new Map(
    arrangement.windows.flatMap((window) => window.workspace.tabs.map((tab) => [tab.id, tab])),
  );
  const targets = memory.windows
    .filter((window) => window.id !== home.id)
    .map((window) => ({ window, tabs: window.tabs.flatMap((id) => tabs.get(id) ?? []) }))
    .filter((target) => target.tabs.length > 0);
  const homeRecord = memory.windows.find((window) => window.id === home.id);
  // An unplugged display's only window went to another display: putting it
  // back is moving it home.
  const homeMoves = memory.automatic && homeRecord !== undefined && !samePlace(homeRecord, home);
  if (targets.length === 0 && !homeMoves) return null;
  const claimed = new Set(targets.flatMap((target) => target.tabs.map((tab) => tab.id)));
  const unclaimed = (window: Placed) => window.workspace.tabs.filter((tab) => !claimed.has(tab.id));

  const windows: Placed[] = [];
  for (const window of arrangement.windows) {
    const target = targets.find((candidate) => candidate.window.id === window.id);
    if (target || window === home) continue;
    const left = unclaimed(window);
    if (left.length > 0) {
      windows.push({ ...window, workspace: workspaceOf(left, window.workspace.activeTabId) });
    }
  }
  for (const { window: record, tabs: own } of targets) {
    const existing = windowById(arrangement, record.id);
    const workspace = workspaceOf(
      [...own, ...(existing ? unclaimed(existing) : [])],
      record.activeTabId,
    );
    windows.push({
      id: record.id,
      frame: record.frame,
      display: record.display,
      fullScreen: record.fullScreen,
      workspace,
    });
  }
  const homeTabs = unclaimed(home);
  if (homeTabs.length > 0) {
    const place = homeRecord ?? home;
    windows.unshift({
      ...home,
      frame: place.frame,
      display: place.display,
      fullScreen: place.fullScreen,
      workspace: workspaceOf(homeTabs, homeRecord?.activeTabId ?? null, home.workspace.activeTabId),
    });
  }

  const staying = new Set(windows.map((window) => window.id));
  const closing = new Set(
    arrangement.windows.filter((window) => !staying.has(window.id)).map((window) => window.id),
  );
  const front = windows[0]!.id;
  const next: Arrangement = {
    windows,
    lead: leadAfter(arrangement, closing, front),
    memories: arrangement.memories.filter((kept) => kept !== memory),
  };
  return moved(arrangement, transactionBetween(arrangement, next));
}

/** The memory Put back spends on this display set: the last Gather's, never an unplug's. */
function gathered(arrangement: Arrangement, displays: string): Memory | null {
  return arrangement.memories.find((kept) => kept.displays === displays && !kept.automatic) ?? null;
}

/** What the strip's button offers: Gather, Put back, or nothing to do. */
export function gatherButton(
  arrangement: Arrangement,
  displays: string,
): "gather" | "putBack" | null {
  if (arrangement.windows.length > 1) return "gather";
  const memory = gathered(arrangement, displays);
  return memory && putBack(arrangement, memory) ? "putBack" : null;
}

/** The button pressed in window `hereId`: what it offers, done. */
export function pressGather(
  arrangement: Arrangement,
  hereId: string,
  displays: string,
): Moved | null {
  switch (gatherButton(arrangement, displays)) {
    case "gather":
      return gather(arrangement, hereId, displays);
    case "putBack":
      return putBack(arrangement, gathered(arrangement, displays)!);
    default:
      return null;
  }
}

/**
 * The windows after the displays change, or at launch against the displays last seen. A
 * display set that returns puts back what its unplugging gathered. Windows on a gone display
 * gather into the front window on those left (if none is, the front one moves to the first
 * display), remembered for the set they left. Every frame ends inside its display.
 */
export function displaysChanged(
  arrangement: Arrangement,
  before: ReadonlyArray<Display>,
  after: ReadonlyArray<Display>,
): Moved | null {
  if (after.length === 0) return null;
  let next = arrangement;
  const returning = next.memories.find(
    (kept) => kept.automatic && kept.displays === displaySetKey(after),
  );
  if (returning) {
    next = putBack(next, returning)?.next ?? {
      ...next,
      memories: next.memories.filter((kept) => kept !== returning),
    };
  }

  const present = new Set(after.map((display) => display.key));
  const displaced = next.windows.filter((window) => !present.has(window.display));
  if (displaced.length > 0) {
    const home = next.windows.find((window) => present.has(window.display)) ?? displaced[0]!;
    const gathered = screenOrder(displaced.filter((window) => window !== home));
    const closing = new Set(gathered.map((window) => window.id));
    const tabs = [home, ...gathered].flatMap((window) => window.workspace.tabs);
    const memory: Memory = {
      displays: displaySetKey(before),
      home: home.id,
      windows: displaced.map(remember),
      automatic: true,
    };
    next = {
      windows: next.windows
        .filter((window) => !closing.has(window.id))
        .map((window) =>
          window === home
            ? { ...home, workspace: workspaceOf(tabs, home.workspace.activeTabId) }
            : window,
        ),
      lead: leadAfter(next, closing, next.windows.find((window) => !closing.has(window.id))!.id),
      memories: rememberIn(next.memories, memory),
    };
  }

  next = {
    ...next,
    windows: next.windows.map((window) => {
      const display =
        after.find((candidate) => candidate.key === window.display) ??
        displayOf(window.frame, after)!;
      const frame = clampFrame(window.frame, display.workArea);
      return { ...window, frame, display: displayOf(frame, after)!.key };
    }),
  };
  const transaction = transactionBetween(arrangement, next);
  const unchanged =
    transaction.open.length + transaction.change.length + transaction.close.length === 0 &&
    transaction.memories === arrangement.memories;
  return unchanged ? null : moved(arrangement, transaction);
}
