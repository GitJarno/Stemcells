import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { DraftId, markPromotedDraftThreadByRef, useComposerDraftStore } from "~/composerDraftStore";

import { activateTab, EMPTY_WORKSPACE, openTab, type CellRef } from "../tabs/layout";
import { newCellTaken, takeNewCell, type NewCell } from "../tabs/newCell";
import { updateWorkspace, useWorkspaceStore } from "../tabs/store";
import { draftSent, NEW_CELL_DRAFT_KEY, readNewCellDraft } from "./newCell";

// The new Cell past the last tab, through upstream's real draft store: left
// unsent, its tab goes and its draft keeps the words; sent with Enter, its
// tab stays, even when left before its thread's route arrives, and is
// stored like any other.

const ENVIRONMENT = EnvironmentId.make("environment-1");
const projectRef = scopeProjectRef(ENVIRONMENT, ProjectId.make("project-1"));
const draftId = DraftId.make("draft-new-cell");
const cell: CellRef = { environmentId: ENVIRONMENT, threadId: "thread-new-cell", draftId };
const newCell: NewCell = {
  ids: { tab: "tab-new", row: "row-new", column: "column-new", pane: "pane-new" },
  cell,
};
const thread = (threadId: string): CellRef => ({
  environmentId: ENVIRONMENT,
  threadId,
  draftId: null,
});
const storedTabIds = (): string[] =>
  (JSON.parse(localStorage.getItem("stemcells.tabs") ?? "{}").tabs ?? []).map(
    (tab: { id: string }) => tab.id,
  );

/** The browser's storage, in memory: what the tabs store keeps. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
  useComposerDraftStore
    .getState()
    .setLogicalProjectDraftThreadId(NEW_CELL_DRAFT_KEY, projectRef, draftId, {
      threadId: ThreadId.make("thread-new-cell"),
      createdAt: "2026-10-21T12:00:00.000Z",
    });
  useWorkspaceStore.setState({
    workspace: openTab(
      openTab(EMPTY_WORKSPACE, newIdsOf("a"), thread("a")),
      newIdsOf("b"),
      thread("b"),
    ),
    visited: [],
    newCell,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function newIdsOf(name: string) {
  return { tab: `tab-${name}`, row: `row-${name}`, column: `column-${name}`, pane: `pane-${name}` };
}

describe("the new Cell, with upstream's drafts", () => {
  it("its draft is the one under its key, unsent", () => {
    expect(readNewCellDraft()).toEqual(cell);
    expect(draftSent(cell)).toBe(false);
  });

  it("taken and left unsent, its tab goes, nothing of it is stored, and its words stay", () => {
    updateWorkspace((current) => takeNewCell(current, newCell));
    expect(newCellTaken(useWorkspaceStore.getState().workspace, newCell)).toBe(true);
    expect(storedTabIds()).toEqual(["tab-a", "tab-b"]);
    useComposerDraftStore.getState().setPrompt(draftId, "Plan the garden");
    updateWorkspace((current) => activateTab(current, "tab-b"));
    const { workspace, newCell: kept } = useWorkspaceStore.getState();
    expect(workspace.tabs.map((tab) => tab.id)).toEqual(["tab-a", "tab-b"]);
    expect(kept).toBe(newCell);
    expect(readNewCellDraft()).toEqual(cell);
    expect(useComposerDraftStore.getState().getComposerDraft(draftId)?.prompt).toBe(
      "Plan the garden",
    );
  });

  it("sent, its tab stays when left before its thread's route arrives, and is stored", () => {
    updateWorkspace((current) => takeNewCell(current, newCell));
    // What upstream's send does to the draft at once.
    markPromotedDraftThreadByRef(scopeThreadRef(ENVIRONMENT, ThreadId.make("thread-new-cell")));
    expect(draftSent(cell)).toBe(true);
    expect(readNewCellDraft()).toBeNull();
    updateWorkspace((current) => activateTab(current, "tab-a"));
    const { workspace, newCell: after } = useWorkspaceStore.getState();
    expect(workspace.tabs.map((tab) => tab.id)).toEqual(["tab-a", "tab-b", "tab-new"]);
    expect(after).toBeNull();
    expect(storedTabIds()).toEqual(["tab-a", "tab-b", "tab-new"]);
  });

  it("sent while it stays on stage, the store lets it go as a Cell's own when asked", () => {
    updateWorkspace((current) => takeNewCell(current, newCell));
    markPromotedDraftThreadByRef(scopeThreadRef(ENVIRONMENT, ThreadId.make("thread-new-cell")));
    useWorkspaceStore.getState().settleNewCell();
    expect(useWorkspaceStore.getState().newCell).toBeNull();
    expect(storedTabIds()).toEqual(["tab-a", "tab-b", "tab-new"]);
  });
});
