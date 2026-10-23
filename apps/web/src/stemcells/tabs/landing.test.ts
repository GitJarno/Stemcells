import { describe, expect, it } from "vite-plus/test";

import { ASKI_TAB_ID } from "./askiTab";
import { landCells, type LandingWindow } from "./landing";
import { panesOf, type CellRef, type NewIds, type Tab, type Workspace } from "./layout";

let n = 0;
const ids = (): NewIds => {
  n += 1;
  return { tab: `t${n}`, row: `r${n}`, column: `c${n}`, pane: `p${n}` };
};
const cell = (threadId: string): CellRef => ({ environmentId: "e", threadId, draftId: null });
/** A Cell's project is the word before its dash: "harbor-1" works in Harbor. */
const projectOf = (of: CellRef) => of.threadId.split("-")[0] ?? null;

const tab = (id: string, ...threads: string[]): Tab => ({
  id,
  rows: [
    {
      id: `${id}-row`,
      columns: threads.map((thread) => ({
        id: `${id}-${thread}`,
        panes: [{ id: `${id}-${thread}-pane`, cell: cell(thread) }],
      })),
    },
  ],
  focusedPaneId: `${id}-${threads[0]}-pane`,
});
const window = (tabs: Tab[], visited: string[] = [], rowWidth = 1200): LandingWindow => ({
  workspace: { tabs, activeTabId: visited[0] ?? tabs[0]?.id ?? null },
  visited,
  rowWidth: () => rowWidth,
});
const shape = (workspace: Workspace) =>
  workspace.tabs.map((each) => panesOf(each).map((pane) => pane.cell?.threadId));
const cells = (...threads: string[]) => threads.map(cell);

describe("where a new Cell lands", () => {
  it("joins its project's tab used last, as columns, and nothing comes to the front", () => {
    const here = window(
      [
        tab(ASKI_TAB_ID, "aski"),
        tab("old", "harbor-1"),
        tab("new", "harbor-2"),
        tab("b", "atlas-1"),
      ],
      [ASKI_TAB_ID, "new", "old"],
    );
    const [landed] = landCells([here], cells("harbor-3", "harbor-4"), projectOf, ids);
    expect(shape(landed!)).toEqual([
      ["aski"],
      ["harbor-1"],
      ["harbor-2", "harbor-3", "harbor-4"],
      ["atlas-1"],
    ]);
    expect(landed!.activeTabId).toBe(ASKI_TAB_ID);
    expect(landed!.tabs[2]!.focusedPaneId).toBe("new-harbor-2-pane");
  });

  it("opens a new tab after the project's tabs when theirs are full, in order", () => {
    const narrow = window(
      [tab(ASKI_TAB_ID, "aski"), tab("h", "harbor-1"), tab("b", "atlas-1")],
      [],
      500,
    );
    const [landed] = landCells([narrow], cells("harbor-2", "harbor-3"), projectOf, ids);
    expect(shape(landed!)).toEqual([
      ["aski"],
      ["harbor-1"],
      ["harbor-2"],
      ["harbor-3"],
      ["atlas-1"],
    ]);
    const wide = window([
      tab(ASKI_TAB_ID, "aski"),
      tab("h", "harbor-1", "harbor-2", "harbor-3", "harbor-4"),
    ]);
    expect(shape(landCells([wide], cells("harbor-5", "harbor-6"), projectOf, ids)[0]!)).toEqual([
      ["aski"],
      ["harbor-1", "harbor-2", "harbor-3", "harbor-4"],
      ["harbor-5", "harbor-6"],
    ]);
  });

  it("goes to the window holding its project's tab, and a new project to the end of Aski's strip", () => {
    const front = window([tab("b", "atlas-1")], ["b"]);
    const detached = window([tab("h", "harbor-1")], ["h"]);
    const home = window([tab(ASKI_TAB_ID, "aski"), tab("x", "atlas-2")]);
    const [inFront, inDetached, inHome] = landCells(
      [front, detached, home],
      cells("harbor-2", "pond-1", "pond-2"),
      projectOf,
      ids,
    );
    expect(inFront).toBe(front.workspace);
    expect(shape(inDetached!)).toEqual([["harbor-1", "harbor-2"]]);
    expect(shape(inHome!)).toEqual([["aski"], ["atlas-2"], ["pond-1", "pond-2"]]);
  });

  it("never lands in Aski's tab, and leaves a Cell already showing where it is", () => {
    // Aski's chat works in no project; a Cell started there shares it.
    const here = window([tab(ASKI_TAB_ID, "scratch-aski"), tab("h", "harbor-1")]);
    const [landed] = landCells([here], cells("scratch-1", "harbor-1"), projectOf, ids);
    expect(shape(landed!)).toEqual([["scratch-aski"], ["harbor-1"], ["scratch-1"]]);
  });
});
