/**
 * Closes this window's panes of each Cell settled by hand on any connected machine, as it comes
 * or, for one made while away, at the next start or reconnect (stemcells/tasks/landing-elsewhere.md).
 * Each window keeps per machine, across restarts, the newest settle it acted on: it closes its
 * panes once, and a Cell reopened after its settle stays.
 */
import { useEffect } from "react";

import { subscribeHandSettles } from "../needs/settles";
import type { HandSettle } from "../needs/wire";
import type { CellRef } from "../tabs/layout";
import { keepLeft, leaveSlateOf, settlesAmong, type Left } from "../tabs/settled";
import { updateWorkspace } from "../tabs/store";
import { windowsBridge } from "./bridge";

const KEY = "stemcells.settles.heardThrough.";
/** A window none has heard of for this long is gone, and its marks with it. */
const FORGET_AFTER_MS = 30 * 24 * 60 * 60_000;

function marksOf(storage: Pick<Storage, "getItem">, key: string): Map<string, number> {
  try {
    const stored: unknown = JSON.parse(storage.getItem(key) ?? "{}");
    if (typeof stored !== "object" || stored === null) return new Map();
    return new Map(
      Object.entries(stored).filter((entry): entry is [string, number] =>
        Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return new Map();
  }
}

/**
 * What window `windowId` acts on from each machine's settles, its marks read from `storage` and
 * kept there; one with no mark for a machine starts at `now`, so nothing older closes.
 */
export function heardSettles(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">,
  windowId: string,
  now: number,
): (environmentId: string, settles: ReadonlyArray<HandSettle>) => CellRef[] {
  const own = KEY + windowId;
  try {
    const gone = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string =>
        key !== null &&
        key.startsWith(KEY) &&
        key !== own &&
        Math.max(0, ...marksOf(storage, key).values()) < now - FORGET_AFTER_MS,
    );
    for (const key of gone) storage.removeItem(key);
  } catch {
    // Unread, a gone window's marks wait for the next start.
  }
  const through = marksOf(storage, own);
  return (environmentId, settles) => {
    const before = through.get(environmentId);
    const cells = settlesAmong(environmentId, settles, through, now);
    if (through.get(environmentId) === before) return cells;
    try {
      storage.setItem(own, JSON.stringify(Object.fromEntries(through)));
    } catch {
      // Lost, this window starts its marks afresh at the next start.
    }
    return cells;
  };
}

/** Closes this window's panes as Cells are settled by hand anywhere it reaches. */
export function useClosesSettledCells(): void {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow every connected machine's settles by hand while this window's workspace shows.
  useEffect(() => {
    const heard = heardSettles(localStorage, windowsBridge()?.boot.id ?? "page", Date.now());
    return subscribeHandSettles((environmentId, settles) => {
      const cells = heard(environmentId, settles);
      if (cells.length === 0) return;
      const out: { left: ReadonlyArray<Left> } = { left: [] };
      updateWorkspace((workspace) => {
        const next = leaveSlateOf(workspace, cells, Date.now());
        out.left = next.left;
        return next.workspace;
      });
      // Undo on any device brings each back, as for a settle made here.
      for (const left of out.left) keepLeft(left);
    });
  }, []);
}
