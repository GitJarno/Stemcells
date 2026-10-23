/**
 * Lands new Cells in their projects' tabs across the app's windows
 * (tabs/landing.ts). In a browser, the one window's workspace takes them;
 * on the desktop, every window's, in one transaction the desktop app
 * carries out, made again from a fresh snapshot if a window changed
 * meanwhile. Not a move: Undo Move doesn't take it back.
 */
import { useEffect } from "react";

import { landCells, type LandingWindow } from "../tabs/landing";
import type { CellRef, Workspace } from "../tabs/layout";
import { newIds, updateWorkspace, useWorkspaceStore } from "../tabs/store";
import { cellProject, subscribeLaunches } from "../upstream/landing";
import type { Placed } from "./arrangement";
import { windowsBridge, type StripPlace } from "./bridge";
import { tabRowWidth } from "./hostStrip";
import { useLeadWindow } from "./lead";
import { readSnapshot, writeTransaction } from "./wire";

const ATTEMPTS = 3;

/** Each chat an agent launches lands as it arrives, placed by the lead window alone. */
export function useLandsLaunches(): void {
  const lead = useLeadWindow();
  useEffect(
    () => (lead ? subscribeLaunches((cells) => void landNewCells(cells)) : undefined),
    [lead],
  );
}

export async function landNewCells(cells: readonly CellRef[]): Promise<void> {
  if (cells.length === 0) return;
  const bridge = windowsBridge();
  const here = (workspace: Workspace): LandingWindow => ({
    workspace,
    visited: useWorkspaceStore.getState().visited,
    rowWidth: tabRowWidth,
  });
  if (!bridge) {
    updateWorkspace((workspace) => landCells([here(workspace)], cells, cellProject, newIds)[0]!);
    return;
  }
  const strips = await bridge.geometry();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const seen = readSnapshot(await bridge.snapshot());
    const { windows, lead, memories } = seen.arrangement;
    const landed = landCells(
      windows.map((window) =>
        window.id === bridge.boot.id ? here(window.workspace) : elsewhere(window, strips),
      ),
      cells,
      cellProject,
      newIds,
    );
    const change = windows.flatMap((window, index): Placed[] =>
      landed[index] === window.workspace ? [] : [{ ...window, workspace: landed[index]! }],
    );
    if (change.length === 0) return;
    const transaction = { open: [], change, close: [], front: null, lead, memories };
    if ((await bridge.commit(writeTransaction(transaction, seen.versions))) === "done") return;
  }
}

/** Another window, as far as this one can see it: its active tab used last, its rows as measured. */
function elsewhere(window: Placed, strips: ReadonlyArray<StripPlace>): LandingWindow {
  const chips = strips.find((strip) => strip.id === window.id)?.strip.chips ?? [];
  const { activeTabId } = window.workspace;
  return {
    workspace: window.workspace,
    visited: activeTabId === null ? [] : [activeTabId],
    rowWidth: (tabId) =>
      chips.find((chip) => chip.tabId === tabId)?.rowWidth ??
      chips[0]?.rowWidth ??
      window.frame.width,
  };
}
