import { create } from "zustand";

import { fileDraftUnderPane } from "../upstream/drafts";
import { draftSent, readNewCellDraft } from "../upstream/newCell";
import { randomUUID } from "../upstream/ui";
import {
  EMPTY_WORKSPACE,
  panesOf,
  parseWorkspace,
  serializeWorkspace,
  type Workspace,
} from "./layout";
import { leaveNewCell, newCellKept, storedWorkspace, type NewCell } from "./newCell";
import { visit } from "./pager";

const WORKSPACE_STORAGE_KEY = "stemcells.tabs";

function readStoredWorkspace(): Workspace {
  if (typeof localStorage === "undefined") return EMPTY_WORKSPACE;
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    return raw === null ? EMPTY_WORKSPACE : parseWorkspace(JSON.parse(raw));
  } catch {
    return EMPTY_WORKSPACE;
  }
}

function writeStoredWorkspace(workspace: Workspace): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(serializeWorkspace(workspace)));
  } catch {
    // A full or blocked storage loses the layout on reload, nothing more.
  }
}

interface WorkspaceStore {
  readonly workspace: Workspace;
  /** The last route the panes took in; a route not yet taken in is new. */
  readonly takenRoute: string | null;
  /** The tabs active last, most recent first: their pages stay mounted. */
  readonly visited: readonly string[];
  /** The new Cell past the last tab, once its draft is made (`newCell.ts`). Never stored. */
  readonly newCell: NewCell | null;
  readonly update: (change: (workspace: Workspace) => Workspace) => void;
  /** The new Cell's tab, sent or changed with nothing else changing, becomes a Cell's own. */
  readonly settleNewCell: () => void;
}

const tabIdsOf = (workspace: Workspace): string[] => workspace.tabs.map((tab) => tab.id);

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  const workspace = readStoredWorkspace();
  return {
    workspace,
    takenRoute: null,
    visited: visit([], workspace.activeTabId, tabIdsOf(workspace)),
    newCell: firstNewCell(),
    update: (change) => {
      const { workspace: previous, newCell } = get();
      const sent = newCell !== null && draftSent(newCell.cell);
      // Left unsent, the new Cell's tab goes again.
      const next = leaveNewCell(change(previous), newCell, sent);
      if (next === previous) return;
      const visited =
        next.activeTabId !== previous.activeTabId || next.tabs.length !== previous.tabs.length
          ? visit(get().visited, next.activeTabId, tabIdsOf(next))
          : get().visited;
      // Sent or changed, it is a Cell's own tab, and a new one is made.
      const kept = newCell !== null && newCellKept(next, newCell, sent);
      set({ workspace: next, visited, ...(kept ? { newCell: null } : {}) });
      if (kept && !sent) keepDraftInItsPane(next, newCell);
      writeStoredWorkspace(storedWorkspace(next, kept ? null : newCell, sent));
    },
    settleNewCell: () => {
      const { workspace: current, newCell } = get();
      if (newCell === null) return;
      const sent = draftSent(newCell.cell);
      if (!newCellKept(current, newCell, sent)) return;
      set({ newCell: null });
      if (!sent) keepDraftInItsPane(current, newCell);
      writeStoredWorkspace(current);
    },
  };
});

/**
 * The new Cell kept from before, if its draft is still there: known from
 * the start, so a route to its draft (a reload while on it) takes it
 * rather than filling the focused pane with it.
 */
function firstNewCell(): NewCell | null {
  const cell = readNewCellDraft();
  return cell === null ? null : { ids: newIds(), cell };
}

/**
 * A new Cell changed into a Cell's own tab before it was sent: its draft,
 * if its pane still shows it, is that pane's now, so it is never taken as
 * the next new Cell's.
 */
function keepDraftInItsPane(workspace: Workspace, newCell: NewCell): void {
  const draftId = newCell.cell.draftId;
  const tab = workspace.tabs.find((candidate) => candidate.id === newCell.ids.tab);
  const pane = tab && panesOf(tab).find((candidate) => candidate.cell?.draftId === draftId);
  if (pane && draftId !== null) fileDraftUnderPane(draftId, pane.id);
}

export function readWorkspace(): Workspace {
  return useWorkspaceStore.getState().workspace;
}

export function updateWorkspace(change: (workspace: Workspace) => Workspace): void {
  useWorkspaceStore.getState().update(change);
}

export function newIds() {
  return {
    tab: randomUUID(),
    row: randomUUID(),
    column: randomUUID(),
    pane: randomUUID(),
  };
}
