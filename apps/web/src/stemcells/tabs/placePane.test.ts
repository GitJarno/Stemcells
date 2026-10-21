import { describe, expect, it } from "vite-plus/test";

import { insertTab, placePane, type Tab, type Workspace } from "./layout";

const cell = (threadId: string) => ({ environmentId: "env", threadId, draftId: null });

/** One tab: panes a and b side by side, c under b. */
function workspace(): Workspace {
  const tab: Tab = {
    id: "t",
    rows: [
      {
        id: "r",
        columns: [
          { id: "ca", panes: [{ id: "a", cell: cell("a") }] },
          {
            id: "cb",
            panes: [
              { id: "b", cell: cell("b") },
              { id: "c", cell: cell("c") },
            ],
          },
        ],
      },
    ],
    focusedPaneId: "a",
  };
  const other: Tab = {
    ...tab,
    id: "u",
    rows: [{ id: "r2", columns: [{ id: "cu", panes: [{ id: "u", cell: cell("u") }] }] }],
    focusedPaneId: "u",
  };
  return { tabs: [tab, other], activeTabId: "u" };
}

const layoutOf = (ws: Workspace) =>
  ws.tabs[0]!.rows.map((row) => row.columns.map((column) => column.panes.map((pane) => pane.id)));
const moving = { id: "m", cell: cell("m") };

describe("placePane", () => {
  it("puts a pane in a new column beside the anchor's", () => {
    expect(layoutOf(placePane(workspace(), moving, "b", "left", "cm", 1200))).toEqual([
      [["a"], ["m"], ["b", "c"]],
    ]);
    expect(layoutOf(placePane(workspace(), moving, "a", "right", "cm", 1200))).toEqual([
      [["a"], ["m"], ["b", "c"]],
    ]);
  });

  it("stacks a pane above or below the anchor in its column", () => {
    expect(layoutOf(placePane(workspace(), moving, "c", "above", "cm", 1200))).toEqual([
      [["a"], ["b", "m", "c"]],
    ]);
    expect(layoutOf(placePane(workspace(), moving, "c", "below", "cm", 1200))).toEqual([
      [["a"], ["b", "c", "m"]],
    ]);
  });

  it("focuses the pane and makes its tab active", () => {
    const placed = placePane(workspace(), moving, "b", "right", "cm", 1200);
    expect(placed.activeTabId).toBe("t");
    expect(placed.tabs[0]!.focusedPaneId).toBe("m");
  });

  it("does nothing without the anchor, or when the pane is already there", () => {
    const start = workspace();
    expect(placePane(start, moving, "nowhere", "left", "cm", 1200)).toBe(start);
    expect(placePane(start, { id: "a", cell: cell("a") }, "b", "left", "cm", 1200)).toBe(start);
  });
});

describe("insertTab", () => {
  it("puts a tab at a clamped slot and keeps the active tab", () => {
    const tab = { ...workspace().tabs[1]!, id: "new" };
    expect(insertTab(workspace(), tab, 1).tabs.map((t) => t.id)).toEqual(["t", "new", "u"]);
    expect(insertTab(workspace(), tab, 9).tabs.map((t) => t.id)).toEqual(["t", "u", "new"]);
    expect(insertTab(workspace(), tab, 0).activeTabId).toBe("u");
  });

  it("makes the first tab of an empty strip active", () => {
    const tab = workspace().tabs[0]!;
    expect(insertTab({ tabs: [], activeTabId: null }, tab, 0)).toEqual({
      tabs: [tab],
      activeTabId: "t",
    });
  });
});
