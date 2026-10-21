import { create } from "zustand";

import { fileDraftUnderPane } from "../upstream/drafts";
import { draftSent, readNewCellDraft } from "../upstream/newCell";
import { randomUUID } from "../upstream/ui";
import { windowsBridge } from "../windows/bridge";
import {
  EMPTY_WORKSPACE,
  panesOf,
  parseWorkspace,
  serializeWorkspace,
  type Workspace,
} from "./layout";
import { leaveNewCell, newCellKept, storedWorkspace, type NewCell } from "./newCell";
import { visit } from "./pager";

/** On the desktop, each window's workspace is kept by the app's windows (stemcells/windows). */
const windows = windowsBridge();

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

/**
 * A window starts from the workspace the desktop app keeps for it. One it
 * has nothing for yet, if it leads, takes what the app kept before it had
 * windows; in a browser, that's where the workspace always lives.
 */
function readStartingWorkspace(): Workspace {
  if (!windows) return readStoredWorkspace();
  const { workspace, lead } = windows.boot;
  if (workspace !== null) return parseWorkspace(workspace);
  const first = lead ? readStoredWorkspace() : EMPTY_WORKSPACE;
  windows.publish(serializeWorkspace(first));
  return first;
}

function keepWorkspace(workspace: Workspace): void {
  if (windows) windows.publish(serializeWorkspace(workspace));
  else writeStoredWorkspace(workspace);
}

interface WorkspaceStore {
  readonly workspace: Workspace;
  /** The last route the panes took in; a route not yet taken in is new. */
  readonly takenRoute: string | null;
  /** The tabs active last, most recent first: their pages stay mounted. */
  readonly visited: readonly string[];
  /** The new Cell past the last tab, once its draft is made (`newCell.ts`). Never stored. */
  readonly newCell: NewCell | null;
  /** The last change came from a move between windows (stemcells/windows), not this window. */
  readonly moved: boolean;
  readonly update: (change: (workspace: Workspace) => Workspace) => void;
  /** The new Cell's tab, sent or changed with nothing else changing, becomes a Cell's own. */
  readonly settleNewCell: () => void;
}

const tabIdsOf = (workspace: Workspace): string[] => workspace.tabs.map((tab) => tab.id);

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  const workspace = readStartingWorkspace();
  return {
    workspace,
    takenRoute: null,
    visited: visit([], workspace.activeTabId, tabIdsOf(workspace)),
    newCell: firstNewCell(),
    moved: false,
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
      set({ workspace: next, visited, moved: false, ...(kept ? { newCell: null } : {}) });
      if (kept && !sent) keepDraftInItsPane(next, newCell);
      keepWorkspace(storedWorkspace(next, kept ? null : newCell, sent));
    },
    settleNewCell: () => {
      const { workspace: current, newCell } = get();
      if (newCell === null) return;
      const sent = draftSent(newCell.cell);
      if (!newCellKept(current, newCell, sent)) return;
      set({ newCell: null });
      if (!sent) keepDraftInItsPane(current, newCell);
      keepWorkspace(current);
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

// A move between windows gives this window a workspace: it's taken as is,
// not published back.
windows?.onAdopt((value) => {
  const workspace = parseWorkspace(value);
  const { visited } = useWorkspaceStore.getState();
  useWorkspaceStore.setState({
    workspace,
    visited: visit(visited, workspace.activeTabId, tabIdsOf(workspace)),
    moved: true,
  });
});

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
