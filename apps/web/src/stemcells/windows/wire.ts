/**
 * Moves over the wire: the desktop app's snapshot read as an arrangement,
 * and a move's transaction written for the desktop app to carry out
 * (stemcells/tasks/windows.md, "The model").
 */
import { EMPTY_WORKSPACE, parseWorkspace, serializeWorkspace } from "../tabs/layout";
import { flushStoreWrites } from "../upstream/sharedStores";
import type { Arrangement, Moved, Placed, Transaction, UndoEntry } from "./arrangement";
import { windowsBridge, type WireSnapshot, type WireTransaction, type WireWindow } from "./bridge";
import { parseAll, parseMemory, parseWindows, serializeWindows } from "./persist";

export interface Seen {
  readonly arrangement: Arrangement;
  /** Each window's version in the snapshot: a move made from it names them. */
  readonly versions: ReadonlyMap<string, number>;
  readonly displays: WireSnapshot["displays"];
}

export function readSnapshot(snapshot: WireSnapshot): Seen {
  const windows = snapshot.windows.map((window): Placed => ({
    id: window.id,
    frame: window.frame,
    display: window.display,
    fullScreen: window.fullScreen,
    workspace: window.workspace === null ? EMPTY_WORKSPACE : parseWorkspace(window.workspace),
  }));
  return {
    arrangement: {
      windows,
      lead: snapshot.lead,
      memories: parseAll(snapshot.memories, parseMemory),
    },
    versions: new Map(snapshot.windows.map((window) => [window.id, window.version])),
    displays: snapshot.displays,
  };
}

const wired = (window: Placed): WireWindow => ({
  ...window,
  workspace: serializeWorkspace(window.workspace),
});

export function writeTransaction(
  transaction: Transaction,
  versions: ReadonlyMap<string, number>,
): WireTransaction {
  const touched = [...transaction.change.map((window) => window.id), ...transaction.close];
  return {
    open: transaction.open.map(wired),
    change: transaction.change.map(wired),
    close: transaction.close,
    front: transaction.front,
    lead: transaction.lead,
    memories: transaction.memories,
    basis: Object.fromEntries(touched.map((id) => [id, versions.get(id) ?? -1])),
  };
}

/** A move's undo entry as the desktop app keeps it for Undo Move. */
export function writeUndo(entry: UndoEntry): unknown {
  return {
    before: serializeWindows({ arrangement: entry.before, displays: [] }),
    after: serializeWindows({ arrangement: entry.after, displays: [] }),
  };
}

/** What `writeUndo` wrote, or null when it isn't one. */
export function readUndo(value: unknown): UndoEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const { before, after } = value as Record<string, unknown>;
  const was = parseWindows(before)?.arrangement;
  const then = parseWindows(after)?.arrangement;
  return was && then ? { before: was, after: then } : null;
}

/** A move made against the windows as they are, again if one changed meanwhile. */
const ATTEMPTS = 3;

/**
 * Makes a move from the desktop app's current windows and has it carried
 * out, kept for Undo Move unless it `undoes` a kept one. When a window it
 * touches changed between the snapshot and the commit, it's made again from
 * a fresh snapshot. Null when there's no move to make, or no desktop app.
 */
export async function commitMove(
  make: (seen: Seen) => Moved | null,
  undoes?: number,
): Promise<Moved | null> {
  const bridge = windowsBridge();
  if (!bridge) return null;
  // What was typed a moment ago is written, for the window a chat goes to.
  flushStoreWrites();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const seen = readSnapshot(await bridge.snapshot());
    const moved = make(seen);
    if (!moved) return null;
    const transaction = {
      ...writeTransaction(moved.transaction, seen.versions),
      ...(undoes === undefined ? { undo: writeUndo(moved.undo) } : { undoes }),
    };
    if ((await bridge.commit(transaction)) === "done") return moved;
  }
  return null;
}
