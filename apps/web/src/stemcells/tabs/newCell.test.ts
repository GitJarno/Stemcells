import { describe, expect, it } from "vite-plus/test";

import {
  activateTab,
  addPane,
  openTab,
  setCell,
  EMPTY_WORKSPACE,
  type CellRef,
  type Workspace,
} from "./layout";
import {
  leaveNewCell,
  newCellKept,
  newCellTab,
  newCellTaken,
  storedWorkspace,
  takeNewCell,
  type NewCell,
} from "./newCell";

// The new Cell past the last tab: taken, it is the last tab; left unsent,
// it goes with no trace in the tabs or the stored layout; sent or changed,
// it is a Cell's own tab.

const ids = (name: string) => ({
  tab: `tab-${name}`,
  row: `row-${name}`,
  column: `column-${name}`,
  pane: `pane-${name}`,
});
const thread = (threadId: string): CellRef => ({ environmentId: "env", threadId, draftId: null });
const newCell: NewCell = {
  ids: ids("new"),
  cell: { environmentId: "env", threadId: "new-thread", draftId: "new-draft" },
};

/** Two Cells' tabs, the second active. */
const two: Workspace = openTab(
  openTab(EMPTY_WORKSPACE, ids("a"), thread("a")),
  ids("b"),
  thread("b"),
);

describe("the new Cell past the last tab", () => {
  it("taken, it is the last tab and the active one, showing its draft", () => {
    const taken = takeNewCell(two, newCell);
    expect(taken.tabs.map((tab) => tab.id)).toEqual(["tab-a", "tab-b", "tab-new"]);
    expect(taken.activeTabId).toBe("tab-new");
    expect(taken.tabs.at(-1)).toEqual(newCellTab(newCell));
    expect(newCellTaken(taken, newCell)).toBe(true);
    expect(takeNewCell(activateTab(taken, "tab-a"), newCell).tabs).toHaveLength(3);
  });

  it("left unsent, its tab goes, and the tab gone to stays active", () => {
    const left = leaveNewCell(activateTab(takeNewCell(two, newCell), "tab-b"), newCell, false);
    expect(left).toEqual(two);
    expect(newCellTaken(left, newCell)).toBe(false);
  });

  it("stays while it is the active tab", () => {
    const taken = takeNewCell(two, newCell);
    expect(leaveNewCell(taken, newCell, false)).toBe(taken);
  });

  it("is never stored while bare, so a reload has no trace of it", () => {
    const taken = takeNewCell(two, newCell);
    expect(storedWorkspace(taken, newCell, false)).toEqual({ ...two, activeTabId: "tab-b" });
  });

  it("sent, it stays when left, is stored, and is a Cell's own tab", () => {
    const taken = takeNewCell(two, newCell);
    const left = leaveNewCell(activateTab(taken, "tab-a"), newCell, true);
    expect(left.tabs.map((tab) => tab.id)).toEqual(["tab-a", "tab-b", "tab-new"]);
    expect(storedWorkspace(taken, newCell, true)).toBe(taken);
    expect(newCellKept(taken, newCell, true)).toBe(true);
  });

  it("its draft arriving as its thread makes it a Cell's own tab", () => {
    const sent = setCell(takeNewCell(two, newCell), "pane-new", {
      ...newCell.cell,
      draftId: null,
    });
    expect(newCellKept(sent, newCell, false)).toBe(true);
    expect(leaveNewCell(activateTab(sent, "tab-a"), newCell, false).tabs).toHaveLength(3);
  });

  it("split into more than the new Cell, it is a Cell's own tab", () => {
    const split = addPane(takeNewCell(two, newCell), ids("c"), 1200);
    expect(newCellTaken(split, newCell)).toBe(false);
    expect(newCellKept(split, newCell, false)).toBe(true);
    expect(leaveNewCell(activateTab(split, "tab-a"), newCell, false).tabs).toHaveLength(3);
  });

  it("not taken, it is nothing of the workspace's", () => {
    expect(newCellTaken(two, newCell)).toBe(false);
    expect(newCellKept(two, newCell, true)).toBe(false);
    expect(leaveNewCell(two, newCell, false)).toBe(two);
    expect(storedWorkspace(two, newCell, false)).toBe(two);
  });
});
