/**
 * A Cell the person settles leaves the slate (stemcells/tasks/aski-manager.md, decision 10): its
 * pane closes, and its tab with its last pane. While upstream's Undo is on offer the place it left
 * is kept, so Undo brings it back to its tab if still open, else a tab of its own where it stood.
 */
import { useSyncExternalStore } from "react";

import { HAND_SETTLE_MS } from "./handSettles";
import {
  arriving,
  closePane,
  findPane,
  insertTab,
  joinTab,
  panesOf,
  paneShowing,
  sameChat,
  type CellRef,
  type NewIds,
  type Workspace,
} from "./layout";

/**
 * Whether a pane leaves the slate: the Cell it showed at work turned settled
 * while the person's settle was fresh (`handSettles.ts`). Upstream's
 * auto-settle leaves no mark, so it never closes a chat under its reader,
 * and a Cell the pane only ever showed settled was opened on purpose.
 */
export function leavesForSettle(input: {
  readonly sawUnsettled: boolean;
  readonly settled: boolean | null;
  readonly markedAt: number | null;
  readonly now: number;
}): boolean {
  return (
    input.sawUnsettled &&
    input.settled === true &&
    input.markedAt !== null &&
    input.now - input.markedAt < HAND_SETTLE_MS
  );
}

/**
 * The Cell a pane's close settles (stemcells/tasks/left-column.md, decision
 * 3): a landed one no other pane here shows, so closing it is the person
 * putting it away. Null for a draft, a Cell still at work or asking, and one
 * another pane keeps.
 */
export function settlesOnClose(
  workspace: Workspace,
  paneId: string,
  landed: (cell: CellRef) => boolean,
): CellRef | null {
  const cell = findPane(workspace, (pane) => pane.id === paneId)?.pane.cell ?? null;
  if (cell === null || cell.draftId !== null) return null;
  const showing = workspace.tabs
    .flatMap(panesOf)
    .filter((pane) => pane.cell !== null && sameChat(pane.cell, cell));
  return showing.length === 1 && landed(cell) ? cell : null;
}

/** Where a settled Cell stood, kept while its settle can be undone. */
export interface Left {
  readonly cell: CellRef;
  readonly tabId: string;
  readonly tabIndex: number;
  /** Its tab was on stage: coming back, it is again. */
  readonly onStage: boolean;
  readonly at: number;
}

/** Upstream offers Undo for 5 s; a slow server's answer gets a little more. */
export const COME_BACK_MS = 10_000;

/** The workspace without the pane, and where it stood. */
export function leaveSlate(
  workspace: Workspace,
  paneId: string,
  at: number,
): { readonly workspace: Workspace; readonly left: Left | null } {
  const found = findPane(workspace, (pane) => pane.id === paneId);
  if (!found || found.pane.cell === null) return { workspace, left: null };
  return {
    workspace: closePane(workspace, paneId),
    left: {
      cell: found.pane.cell,
      tabId: found.tab.id,
      tabIndex: workspace.tabs.indexOf(found.tab),
      onStage: workspace.activeTabId === found.tab.id,
      at,
    },
  };
}

/** The Cell back where it stood, unless it already shows somewhere. */
export function comeBack(
  workspace: Workspace,
  left: Left,
  ids: NewIds,
  rowWidth: number,
): Workspace {
  if (paneShowing(workspace, left.cell)) return workspace;
  const pane = { id: ids.pane, cell: left.cell };
  const stage = (next: Workspace, tabId: string) =>
    left.onStage ? { ...next, activeTabId: tabId } : next;
  if (workspace.tabs.some((tab) => tab.id === left.tabId)) {
    return stage(joinTab(workspace, left.tabId, pane, ids.column, rowWidth), left.tabId);
  }
  const tab = {
    id: ids.tab,
    rows: [{ id: ids.row, columns: [{ id: ids.column, panes: [arriving(pane)] }] }],
    focusedPaneId: pane.id,
  };
  return stage(insertTab(workspace, tab, left.tabIndex), tab.id);
}

// The places kept, by the Cell's thread, for the watchers that bring them back.
let kept: ReadonlyArray<Left> = [];
const listeners = new Set<() => void>();
const tell = () => {
  for (const listener of listeners) listener();
};

export function keepLeft(left: Left): void {
  kept = [...kept.filter((each) => each.cell.threadId !== left.cell.threadId), left];
  tell();
}

export function forgetLeft(threadId: string): void {
  if (!kept.some((each) => each.cell.threadId === threadId)) return;
  kept = kept.filter((each) => each.cell.threadId !== threadId);
  tell();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => kept;

export function useLeft(): ReadonlyArray<Left> {
  return useSyncExternalStore(subscribe, read, read);
}
