import { describe, expect, it } from "vite-plus/test";

import { carry } from "../windows/moves";
import { arrangement, frame, tab, window as placed } from "../windows/fixtures";
import {
  addPane,
  closePane,
  evenOut,
  focusPane,
  MIN_COLUMN_WIDTH,
  openTab,
  placePane,
  parseWorkspace,
  resizePair,
  rowFloor,
  MIN_PANE_HEIGHT,
  serializeWorkspace,
  setCell,
  sharesOf,
  splitDown,
  splitRight,
  type NewIds,
  type Workspace,
} from "./layout";

let counter = 0;
function ids(): NewIds {
  counter += 1;
  return {
    tab: `tab-${counter}`,
    row: `row-${counter}`,
    column: `col-${counter}`,
    pane: `pane-${counter}`,
  };
}

/** A tab of `n` Cells side by side. */
function besideEachOther(n: number): Workspace {
  let workspace = openTab({ tabs: [], activeTabId: null }, ids(), {
    environmentId: "env",
    threadId: "t0",
    draftId: null,
  });
  for (let i = 1; i < n; i++) {
    workspace = splitRight(workspace, ids(), 4000);
    workspace = setCell(workspace, workspace.tabs[0]!.focusedPaneId, {
      environmentId: "env",
      threadId: `t${i}`,
      draftId: null,
    });
  }
  return workspace;
}

const row = (workspace: Workspace) => workspace.tabs[0]!.rows[0]!;
const columnShares = (workspace: Workspace) =>
  sharesOf(row(workspace).columns).map((share) => Number(share.toFixed(3)));

describe("Cells share their row", () => {
  it("evenly until a border is dragged", () => {
    expect(columnShares(besideEachOther(3))).toEqual([1, 1, 1]);
  });

  it("a dragged border moves only its two neighbours", () => {
    const workspace = besideEachOther(3);
    const dragged = resizePair(workspace, row(workspace).id, 0, 600, 200);
    expect(columnShares(dragged)).toEqual([1.5, 0.5, 1]);
  });

  it("a double-click evens the whole row out", () => {
    const workspace = besideEachOther(3);
    const dragged = resizePair(workspace, row(workspace).id, 0, 600, 200);
    expect(columnShares(evenOut(dragged, row(dragged).id))).toEqual([1, 1, 1]);
  });

  it("a newcomer takes an even width, given by the others as they have room over their floor", () => {
    const workspace = besideEachOther(2);
    const dragged = resizePair(workspace, row(workspace).id, 0, 600, 200);
    const added = splitRight(dragged, ids(), 4000);
    // 3000 | 1000 and one more: it takes 1333, the first giving 2840/3680 of that.
    const widths = sharesOf(row(added).columns).map((share) => Math.round((4000 * share) / 3));
    expect(widths).toEqual([1971, 696, 1333]);
  });

  it("a closed Cell's room goes to the rest by their shares", () => {
    const workspace = besideEachOther(3);
    const dragged = resizePair(workspace, row(workspace).id, 0, 600, 200);
    const closed = closePane(dragged, row(dragged).columns[2]!.panes[0]!.id);
    expect(columnShares(closed)).toEqual([1.5, 0.5]);
  });

  it("stacked panes share their column, and a row is as short as its tallest stack lets it", () => {
    let workspace = besideEachOther(2);
    workspace = focusPane(workspace, row(workspace).columns[1]!.panes[0]!.id);
    workspace = splitDown(workspace, ids());
    const column = row(workspace).columns[1]!;
    const resized = resizePair(workspace, column.id, 0, 300, 500);
    const panes = row(resized).columns[1]!.panes;
    expect(sharesOf(panes)).toEqual([0.75, 1.25]);
    expect(rowFloor(row(resized))).toBe(2 * MIN_PANE_HEIGHT);
  });

  it("shares survive a reload", () => {
    const workspace = besideEachOther(2);
    const dragged = resizePair(workspace, row(workspace).id, 0, 600, 200);
    const reloaded = parseWorkspace(JSON.parse(JSON.stringify(serializeWorkspace(dragged))));
    expect(columnShares(reloaded)).toEqual([1.5, 0.5]);
  });

  it("a share that isn't a positive number reloads as an even one", () => {
    const stored = JSON.parse(JSON.stringify(serializeWorkspace(besideEachOther(2))));
    stored.tabs[0].rows[0].columns[0].share = -3;
    stored.tabs[0].rows[0].columns[1].share = "wide";
    expect(columnShares(parseWorkspace(stored))).toEqual([1, 1]);
  });

  it("shares that don't fit the parent change nothing", () => {
    const workspace = besideEachOther(2);
    expect(resizePair(workspace, row(workspace).id, 1, 600, 200)).toBe(workspace);
    expect(resizePair(workspace, "no-such-parent", 0, 600, 200)).toBe(workspace);
  });
});

/** The row's columns' widths, as a row `width` wide lays them out. */
const widthsOf = (workspace: Workspace, width: number, rowIndex = 0) => {
  const columns = workspace.tabs[0]!.rows[rowIndex]!.columns;
  return sharesOf(columns).map((share) => Math.round((width * share) / columns.length));
};

// A Cell closed or carried away left its siblings' shares as they were: at
// 0.4 and 1.6, closing the second left the first filling 40% of its row.
describe("what is left fills its parent", () => {
  it("a closed column's room goes to the rest, whatever their shares were", () => {
    const workspace = besideEachOther(2);
    const dragged = resizePair(workspace, row(workspace).id, 0, 200, 800);
    const closed = closePane(dragged, row(dragged).columns[1]!.panes[0]!.id);
    expect(widthsOf(closed, 1000)).toEqual([1000]);
    const three = resizePair(besideEachOther(3), "row-1", 0, 200, 800);
    const middle = closePane(three, row(three).columns[1]!.panes[0]!.id);
    expect(columnShares(middle).reduce((sum, share) => sum + share, 0)).toBeCloseTo(2, 9);
  });

  it("a stack and the tab's rows fill theirs too", () => {
    let workspace = besideEachOther(1);
    workspace = splitDown(workspace, ids());
    workspace = setCell(workspace, workspace.tabs[0]!.focusedPaneId, {
      environmentId: "env",
      threadId: "below",
      draftId: null,
    });
    const column = row(workspace).columns[0]!;
    const resized = resizePair(workspace, column.id, 0, 100, 700);
    const closed = closePane(resized, row(resized).columns[0]!.panes[1]!.id);
    expect(sharesOf(row(closed).columns[0]!.panes)).toEqual([1]);

    let rows = splitRight(besideEachOther(1), ids(), 200);
    rows = setCell(rows, rows.tabs[0]!.focusedPaneId, {
      environmentId: "env",
      threadId: "under",
      draftId: null,
    });
    expect(rows.tabs[0]!.rows).toHaveLength(2);
    const tall = resizePair(rows, rows.tabs[0]!.id, 0, 900, 100);
    const shut = closePane(tall, rows.tabs[0]!.rows[0]!.columns[0]!.panes[0]!.id);
    expect(sharesOf(shut.tabs[0]!.rows)).toEqual([1]);
  });

  it("a pane moved beside others arrives with an even share, not the one it had", () => {
    let workspace = besideEachOther(1);
    for (const threadId of ["second", "third"]) {
      workspace = splitDown(workspace, ids());
      workspace = setCell(workspace, workspace.tabs[0]!.focusedPaneId, {
        environmentId: "env",
        threadId,
        draftId: null,
      });
    }
    const stack = row(workspace).columns[0]!;
    const dragged = resizePair(workspace, stack.id, 1, 200, 800);
    const moving = row(dragged).columns[0]!.panes[2]!;
    expect(moving.share).toBeCloseTo(1.6, 9);
    const left = closePane(dragged, moving.id);
    const anchor = row(left).columns[0]!.panes[0]!.id;
    const placed = placePane(left, moving, anchor, "right", "c-x", 1200);
    expect(row(placed).columns[1]!.panes[0]!.share).toBeUndefined();
    expect(
      sharesOf(row(placed).columns[0]!.panes).reduce((sum, share) => sum + share, 0),
    ).toBeCloseTo(2, 9);
  });

  it("a chat carried into a new tab fills it, and its old row fills itself", () => {
    const start = arrangement(
      placed("a", frame(0), [tab("a1", "x", "y")]),
      placed("b", frame(1000), [tab("b1", "p")]),
    );
    const a = start.windows[0]!;
    const workspace = resizePair(a.workspace, "a1.row", 0, 200, 800);
    const dragged = { ...start, windows: [{ ...a, workspace }, start.windows[1]!] };
    const moved = carry(dragged, "a1.y", {
      kind: "strip",
      window: "b",
      index: 1,
      ids: { tab: "t-new", row: "r-new", column: "c-new" },
    })!;
    const into = moved.next.windows.find((w) => w.id === "b")!.workspace.tabs[1]!;
    expect(into.rows[0]!.columns[0]!.panes[0]!.share).toBeUndefined();
    const from = moved.next.windows.find((w) => w.id === "a")!.workspace.tabs[0]!;
    expect(sharesOf(from.rows[0]!.columns)).toEqual([1]);
  });
});

// Opening a Cell beside a narrow one assumed even widths: 160 | 840 and ⌘D
// gave 107 / 560 / 333, the first under its floor.
describe("a newcomer beside others keeps every column over its floor", () => {
  it("takes its room from the columns that have it over the floor", () => {
    const workspace = besideEachOther(2);
    const narrow = resizePair(workspace, row(workspace).id, 0, 160, 840);
    const added = splitRight(narrow, ids(), 1000);
    const widths = widthsOf(added, 1000);
    expect(widths).toEqual([160, 507, 333]);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH);
  });

  it("starts a new row, or a stack, when the others haven't the room", () => {
    const workspace = besideEachOther(2);
    const narrow = resizePair(workspace, row(workspace).id, 0, 160, 300);
    const added = splitRight(narrow, ids(), 460);
    expect(added.tabs[0]!.rows).toHaveLength(2);
    expect(widthsOf(added, 460)).toEqual([160, 300]);
    const stacked = addPane(narrow, ids(), 460);
    expect(stacked.tabs[0]!.rows).toHaveLength(1);
    expect(row(stacked).columns.map((column) => column.panes.length)).toEqual([1, 2]);
  });

  // A chat dropped beside a Cell still came in at an even share: 160 | 840
  // and a drop on the right gave 107 / 560 / 333.
  it("so does a pane dropped beside one, or it stacks with the one it was dropped on", () => {
    const workspace = besideEachOther(2);
    const [first, second] = row(workspace).columns.map((column) => column.panes[0]!.id);
    const moving = {
      id: "dropped",
      cell: { environmentId: "env", threadId: "dropped", draftId: null },
    };
    const narrow = resizePair(workspace, row(workspace).id, 0, 160, 840);
    const right = placePane(narrow, moving, second!, "right", "c-x", 1000);
    expect(widthsOf(right, 1000)).toEqual([160, 507, 333]);
    const left = placePane(narrow, moving, first!, "left", "c-x", 1000);
    expect(widthsOf(left, 1000)).toEqual([333, 160, 507]);

    const panesOfRow = (placed: Workspace) =>
      row(placed).columns.map((column) => column.panes.map((pane) => pane.id));
    const crowded = resizePair(workspace, row(workspace).id, 0, 160, 300);
    const under = placePane(crowded, moving, first!, "right", "c-x", 460);
    expect(panesOfRow(under)).toEqual([[first, "dropped"], [second]]);
    expect(widthsOf(under, 460)).toEqual([160, 300]);
    const over = placePane(crowded, moving, second!, "left", "c-x", 460);
    expect(panesOfRow(over)).toEqual([[first], ["dropped", second]]);
    expect(over.tabs[0]!.focusedPaneId).toBe("dropped");
  });
});
