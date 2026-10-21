import { describe, expect, it } from "vite-plus/test";

import { type CellRef, type NewIds, panesOf, type Workspace } from "../tabs/layout";
import { placeCells } from "./placement";

describe("where the Cells land", () => {
  let n = 0;
  const ids = (): NewIds => {
    n += 1;
    return { tab: `t${n}`, row: `r${n}`, column: `c${n}`, pane: `p${n}` };
  };
  const cell = (id: string): CellRef => ({ environmentId: "e", threadId: id, draftId: null });
  const start: Workspace = {
    tabs: [
      {
        id: "t0",
        rows: [{ id: "r0", columns: [{ id: "c0", panes: [{ id: "p0", cell: cell("first") }] }] }],
        focusedPaneId: "p0",
      },
      {
        id: "tz",
        rows: [{ id: "rz", columns: [{ id: "cz", panes: [{ id: "pz", cell: cell("other") }] }] }],
        focusedPaneId: "pz",
      },
    ],
    activeTabId: "t0",
  };
  const threads = (w: Workspace) =>
    w.tabs.map((tab) => panesOf(tab).map((pane) => pane.cell?.threadId));
  const siblings = (k: number) => Array.from({ length: k }, (_, i) => cell(`s${i + 1}`));

  it("opens the others as columns after the first, up to 4 panes", () => {
    const placed = placeCells(start, "p0", siblings(2), 1200, ids);
    expect(threads(placed)).toEqual([["first", "s1", "s2"], ["other"]]);
    expect(placed.activeTabId).toBe("t0");
    expect(placed.tabs[0]!.focusedPaneId).toBe("p0");
  });

  it("opens the rest in new tabs right after, by the same rule", () => {
    const placed = placeCells(start, "p0", siblings(5), 1200, ids);
    expect(threads(placed)).toEqual([["first", "s1", "s2", "s3"], ["s4", "s5"], ["other"]]);
  });

  it("keeps every column 300 px wide", () => {
    expect(threads(placeCells(start, "p0", siblings(3), 700, ids))).toEqual([
      ["first", "s1"],
      ["s2", "s3"],
      ["other"],
    ]);
  });

  it("gives each its own tab when no second column fits", () => {
    expect(threads(placeCells(start, "p0", siblings(2), 500, ids))).toEqual([
      ["first"],
      ["s1"],
      ["s2"],
      ["other"],
    ]);
  });
});
