import { create } from "zustand";

import { randomUUID } from "../upstream/ui";
import { EMPTY_WORKSPACE, parseWorkspace, serializeWorkspace, type Workspace } from "./layout";
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
  readonly update: (change: (workspace: Workspace) => Workspace) => void;
}

const tabIdsOf = (workspace: Workspace): string[] => workspace.tabs.map((tab) => tab.id);

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  const workspace = readStoredWorkspace();
  return {
    workspace,
    takenRoute: null,
    visited: visit([], workspace.activeTabId, tabIdsOf(workspace)),
    update: (change) => {
      const previous = get().workspace;
      const next = change(previous);
      if (next === previous) return;
      const visited =
        next.activeTabId !== previous.activeTabId || next.tabs.length !== previous.tabs.length
          ? visit(get().visited, next.activeTabId, tabIdsOf(next))
          : get().visited;
      set({ workspace: next, visited });
      writeStoredWorkspace(next);
    },
  };
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
