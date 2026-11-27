/**
 * Lands new Cells in their projects' tabs across the app's windows (tabs/landing.ts), once
 * their chats are known. This window takes its share through its own store, which keeps the
 * unsent new Cell's tab its published workspace leaves out; on the desktop, the others take
 * theirs in one transaction, remade if a window changed meanwhile. Undo Move skips it.
 */
import { useEffect } from "react";

import { landCells, type LandingWindow } from "../tabs/landing";
import type { CellRef, Land, Workspace } from "../tabs/layout";
import { newCellTaken } from "../tabs/newCell";
import { newIds, updateWorkspace, useWorkspaceStore } from "../tabs/store";
import { cellProject, cellsKnown, subscribeArrivals } from "../upstream/landing";
import type { Placed } from "./arrangement";
import { windowsBridge, type StripPlace } from "./bridge";
import { tabRowWidth } from "./hostStrip";
import { useLeadWindow } from "./lead";
import { readSnapshot, writeTransaction } from "./wire";

const ATTEMPTS = 3;

/**
 * Each chat started elsewhere (the phone, another Mac, an agent) lands as it
 * arrives, or at the next start if the app was closed, placed by the lead
 * window alone.
 */
export function useLandsNewChats(): void {
  const lead = useLeadWindow();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to new chats while this is the lead window and unsubscribe when it isn't.
  useEffect(
    () => (lead ? subscribeArrivals((cells) => void landNewCells(cells)) : undefined),
    [lead],
  );
}

/** Cells that open no tab as they start, by thread: those Aski's plan starts (aski-orchestrator.md, decision 5). */
const tabless = new Set<string>();
const TABLESS_KEPT = 200;
/** Every window hears it: the lead window lands, whichever window holds Aski's chat. */
const tablessWire =
  typeof BroadcastChannel === "function" ? new BroadcastChannel("stemcells.landing.noTab") : null;

function keepTabless(threadIds: readonly string[]): void {
  for (const threadId of threadIds) tabless.add(threadId);
  for (const threadId of tabless) {
    if (tabless.size <= TABLESS_KEPT) break;
    tabless.delete(threadId);
  }
}
tablessWire?.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (Array.isArray(event.data))
    keepTabless(event.data.filter((id): id is string => typeof id === "string"));
});

/**
 * The Cells of `threadIds` open no tab when they start: they form in Awake, and a click there
 * opens one. Say it before they are launched, in any window.
 */
export function opensNoTab(threadIds: readonly string[]): void {
  keepTabless(threadIds);
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- A BroadcastChannel reaches this origin's windows only; it takes no target.
  tablessWire?.postMessage([...threadIds]);
}

export async function landNewCells(arrived: readonly CellRef[]): Promise<void> {
  const cells = arrived.filter((cell) => !tabless.has(cell.threadId));
  if (cells.length === 0) return;
  // A Cell started a moment ago has no project here until its chat shows.
  await cellsKnown(cells);
  const bridge = windowsBridge();
  if (!bridge) {
    updateWorkspace((workspace) => landCells([here(workspace)], cells, cellProject, newIds)[0]!);
    return;
  }
  const strips = await bridge.geometry();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const seen = readSnapshot(await bridge.snapshot());
    const { windows, lead, memories } = seen.arrangement;
    const change: Placed[] = [];
    updateWorkspace((workspace) => {
      const landed = landCells(
        windows.map((window) =>
          window.id === bridge.boot.id ? here(workspace) : elsewhere(window, strips),
        ),
        cells,
        cellProject,
        newIds,
      );
      windows.forEach((window, index) => {
        if (window.id !== bridge.boot.id && landed[index] !== window.workspace)
          change.push({ ...window, workspace: landed[index]! });
      });
      const at = windows.findIndex((window) => window.id === bridge.boot.id);
      return at < 0 ? workspace : landed[at]!;
    });
    if (change.length === 0) return;
    const transaction = { open: [], change, close: [], front: null, lead, memories };
    // Made again from a fresh snapshot, it skips the Cells that landed here.
    if ((await bridge.commit(writeTransaction(transaction, seen.versions))) === "done") return;
  }
}

/**
 * A chat opened here that no pane shows: in this window, where a new Cell
 * would land. Its chat is known, as it was opened from it.
 */
export const landHere: Land = (workspace, cell, ids) =>
  landCells([here(workspace)], [cell], cellProject, () => ids)[0] ?? workspace;

/** This window: its tabs used last, its rows as drawn, and its unsent new Cell's tab passed by. */
function here(workspace: Workspace): LandingWindow {
  const { visited, newCell } = useWorkspaceStore.getState();
  return {
    workspace,
    visited,
    rowWidth: tabRowWidth,
    passing: newCell !== null && newCellTaken(workspace, newCell) ? newCell.ids.tab : null,
  };
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
