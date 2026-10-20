import { create } from "zustand";

import { randomUUID } from "../upstream/ui";
import { EMPTY_WORKSPACE, parseWorkspace, serializeWorkspace, type Workspace } from "./layout";

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
  readonly update: (change: (workspace: Workspace) => Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspace: readStoredWorkspace(),
  takenRoute: null,
  update: (change) => {
    const previous = get().workspace;
    const next = change(previous);
    if (next === previous) return;
    set({ workspace: next });
    writeStoredWorkspace(next);
  },
}));

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
