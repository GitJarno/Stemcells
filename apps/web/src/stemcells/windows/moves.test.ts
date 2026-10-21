import { describe, expect, it } from "vite-plus/test";

import { ASKI_TAB_ID } from "../tabs/askiTab";
import { focusPane, panesOf, setCell } from "../tabs/layout";
import {
  applyTransaction,
  problemsOf,
  shapeOf,
  windowById,
  windowHoldingPane,
  type Arrangement,
} from "./arrangement";
import {
  arrangement,
  askiTab,
  frame,
  LAPTOP,
  randomArrangement,
  randomMove,
  settled,
  tab,
  window,
} from "./fixtures";
import { carry, closeWindow, join, tear, undo } from "./moves";

const shapes = (a: Arrangement) =>
  Object.fromEntries(a.windows.map((w) => [w.id, [shapeOf(w.workspace), w.frame]]));
const ids = { tab: "t-new", row: "r-new", column: "c-new" };
const where = { id: "w-new", frame: frame(300), display: LAPTOP.key };
const tabIds = (a: Arrangement, id: string) =>
  windowById(a, id)?.workspace.tabs.map((t) => t.id) ?? null;

function twoWindows(): Arrangement {
  return arrangement(
    window("a", frame(0), [askiTab(), tab("a1", "x"), tab("a2", "y", "z")]),
    window("b", frame(1000), [tab("b1", "p"), tab("b2", "q")]),
  );
}

describe("tear", () => {
  it("opens a window holding the tab, in front, and the source shows the right neighbour", () => {
    const start = twoWindows();
    const result = tear(start, "a1", where)!;
    expect(tabIds(result.next, "w-new")).toEqual(["a1"]);
    expect(tabIds(result.next, "a")).toEqual([ASKI_TAB_ID, "a2"]);
    expect(result.next.windows[0]!.id).toBe("w-new");
    expect(result.next.windows[0]!.frame).toEqual(where.frame);
    expect(problemsOf(result.next)).toEqual([]);
  });

  it("shows the left neighbour when the torn tab was last", () => {
    const start = twoWindows();
    const active = {
      ...start.windows[0]!,
      workspace: { ...start.windows[0]!.workspace, activeTabId: "a2" },
    };
    const result = tear({ ...start, windows: [active, start.windows[1]!] }, "a2", where)!;
    expect(windowById(result.next, "a")!.workspace.activeTabId).toBe("a1");
  });

  it("doesn't tear a window's only tab: that window moves instead", () => {
    const start = arrangement(window("a", frame(0), [tab("a1", "x")]));
    expect(tear(start, "a1", where)).toBeNull();
  });

  it("tears Aski's tab off like any other", () => {
    const result = tear(twoWindows(), ASKI_TAB_ID, where)!;
    expect(tabIds(result.next, "w-new")).toEqual([ASKI_TAB_ID]);
  });
});

describe("join", () => {
  it("puts the tab at the slot and makes it active; Aski's tab stays first", () => {
    const result = join(twoWindows(), "b2", "a", 0)!;
    expect(tabIds(result.next, "a")).toEqual([ASKI_TAB_ID, "b2", "a1", "a2"]);
    expect(windowById(result.next, "a")!.workspace.activeTabId).toBe("b2");
    expect(result.next.windows[0]!.id).toBe("a");
  });

  it("puts Aski's tab first in its new strip", () => {
    const result = join(twoWindows(), ASKI_TAB_ID, "b", 2)!;
    expect(tabIds(result.next, "b")).toEqual([ASKI_TAB_ID, "b1", "b2"]);
  });

  it("closes a window its last tab left, and the lead passes on with it", () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x")]),
      window("b", frame(1000), [tab("b1", "y")]),
    );
    const result = join(start, "a1", "b", 9)!;
    expect(result.transaction.close).toEqual(["a"]);
    expect(result.next.lead).toBe("b");
    expect(tabIds(result.next, "b")).toEqual(["b1", "a1"]);
  });

  it("is no move within one window", () => {
    expect(join(twoWindows(), "a1", "a", 2)).toBeNull();
  });
});

describe("carry", () => {
  it("puts a chat on a side of a pane in another window, focused", () => {
    const result = carry(twoWindows(), "a2.z", {
      kind: "pane",
      anchor: "b1.p",
      side: "left",
      column: "c-new",
      rowWidth: 1200,
    })!;
    const b1 = windowById(result.next, "b")!.workspace.tabs[0]!;
    expect(b1.rows[0]!.columns.map((column) => column.panes.map((pane) => pane.id))).toEqual([
      ["a2.z"],
      ["b1.p"],
    ]);
    expect(b1.focusedPaneId).toBe("a2.z");
    expect(panesOf(windowById(result.next, "a")!.workspace.tabs[2]!).map((p) => p.id)).toEqual([
      "a2.y",
    ]);
  });

  it("stacks a chat above or below a pane in its column", () => {
    const result = carry(twoWindows(), "a2.z", {
      kind: "pane",
      anchor: "b1.p",
      side: "above",
      column: "c-new",
      rowWidth: 1200,
    })!;
    const column = windowById(result.next, "b")!.workspace.tabs[0]!.rows[0]!.columns[0]!;
    expect(column.panes.map((pane) => pane.id)).toEqual(["a2.z", "b1.p"]);
  });

  it("makes a chat a tab of its own in a strip, and a window of its own in open space", () => {
    const toStrip = carry(twoWindows(), "a2.z", { kind: "strip", window: "b", index: 1, ids })!;
    expect(tabIds(toStrip.next, "b")).toEqual(["b1", "t-new", "b2"]);
    const toWindow = carry(twoWindows(), "a2.z", { kind: "window", window: where, ids })!;
    expect(tabIds(toWindow.next, "w-new")).toEqual(["t-new"]);
    expect(windowHoldingPane(toWindow.next, "a2.z")!.window.id).toBe("w-new");
  });

  it("closes the tab its last chat left, and the window its last tab left", () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x")]),
      window("b", frame(1000), [tab("b1", "y")]),
    );
    const result = carry(start, "a1.x", {
      kind: "pane",
      anchor: "b1.y",
      side: "right",
      column: "c",
      rowWidth: 1200,
    })!;
    expect(result.transaction.close).toEqual(["a"]);
    expect(problemsOf(result.next)).toEqual([]);
  });

  it("keeps Aski's chat in Aski's tab, and Aski's tab to Aski", () => {
    expect(
      carry(twoWindows(), "aski-tab.aski", { kind: "strip", window: "b", index: 0, ids }),
    ).toBeNull();
    expect(
      carry(twoWindows(), "b1.p", {
        kind: "pane",
        anchor: "aski-tab.aski",
        side: "left",
        column: "c",
        rowWidth: 1200,
      }),
    ).toBeNull();
  });

  it("doesn't carry a window's only chat out into a window: that window moves", () => {
    const start = arrangement(window("a", frame(0), [tab("a1", "x")]));
    expect(carry(start, "a1.x", { kind: "window", window: where, ids })).toBeNull();
  });
});

describe("closeWindow", () => {
  it("sends Aski's tab home to the lead, first", () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x")]),
      window("b", frame(1000), [askiTab(), tab("b1", "y")]),
    );
    const result = closeWindow(start, "b")!;
    expect(tabIds(result.next, "a")).toEqual([ASKI_TAB_ID, "a1"]);
    expect(windowById(result.next, "a")!.workspace.activeTabId).toBe("a1");
  });

  it("passes the lead to the front window left", () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x")]),
      window("b", frame(1000), [tab("b1", "y")]),
      window("c", frame(2000), [tab("c1", "z")]),
    );
    expect(closeWindow(start, "a")!.next.lead).toBe("b");
  });

  it("keeps the last window's record for the next window", () => {
    expect(closeWindow(arrangement(window("a", frame(0), [tab("a1", "x")])), "a")).toBeNull();
  });
});

describe("undo", () => {
  it("takes a tear back", () => {
    const start = twoWindows();
    const torn = tear(start, "a1", where)!;
    const back = undo(torn.next, torn.undo)!;
    expect(back.transaction.close).toEqual(["w-new"]);
    expect(settled(back.next)).toEqual(settled(start));
    expect(back.next.windows[0]!.id).toBe("a");
  });

  it("reopens a window the move closed, where it was", () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x")]),
      window("b", frame(1000), [tab("b1", "y")]),
    );
    const joined = join(start, "a1", "b", 1)!;
    const back = undo(joined.next, joined.undo)!;
    expect(back.transaction.open.map((w) => w.id)).toEqual(["a"]);
    expect(settled(back.next)).toEqual(settled(start));
    // The lead stays with the window it passed to: nothing a person sees.
    expect(back.next.lead).toBe("b");
  });

  it("still applies after focus moves, and keeps a draft that became its thread", () => {
    const start = twoWindows();
    const carried = carry(start, "a2.z", { kind: "strip", window: "b", index: 9, ids })!;
    const b = windowById(carried.next, "b")!;
    const sent = { environmentId: "env", threadId: "z", draftId: null };
    const draftBefore = { ...b, workspace: setCell(focusPane(b.workspace, "b1.p"), "a2.z", sent) };
    const now = applyTransaction(carried.next, {
      ...carried.transaction,
      open: [],
      close: [],
      change: [draftBefore],
      front: "b",
    });
    const back = undo(now, carried.undo)!;
    expect(windowHoldingPane(back.next, "a2.z")!.window.id).toBe("a");
    expect(windowHoldingPane(back.next, "a2.z")!.pane.cell).toEqual(sent);
  });

  it("refuses once a window it touched has changed shape", () => {
    const start = twoWindows();
    const torn = tear(start, "a1", where)!;
    const moreTabs = join(torn.next, "b1", "w-new", 1)!;
    expect(undo(moreTabs.next, torn.undo)).toBeNull();
  });

  it("leaves a window moved by hand since where it is", () => {
    const start = twoWindows();
    const torn = tear(start, "a1", where)!;
    const a = windowById(torn.next, "a")!;
    const dragged = applyTransaction(torn.next, {
      ...torn.transaction,
      open: [],
      close: [],
      change: [{ ...a, frame: frame(50, 300) }],
      front: "a",
    });
    expect(windowById(undo(dragged, torn.undo)!.next, "a")!.frame).toEqual(frame(50, 300));
  });
});

describe("any move", () => {
  it("leaves no tab, pane or chat in two places, and its undo returns every window", () => {
    let checked = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const start = randomArrangement(seed);
      const result = randomMove(start, seed * 7919);
      if (!result) continue;
      checked += 1;
      expect(problemsOf(result.next), `seed ${seed}`).toEqual([]);
      expect(applyTransaction(start, result.transaction)).toEqual(result.next);
      const back = undo(result.next, result.undo);
      expect(back, `seed ${seed}`).not.toBeNull();
      expect(settled(back!.next), `seed ${seed}`).toEqual(settled(start));
      expect(problemsOf(back!.next), `seed ${seed}`).toEqual([]);
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("keeps every arrangement whole along a walk of moves, each one undoable", () => {
    const kinds = new Set<string>();
    for (let walk = 1; walk <= 40; walk++) {
      let current = randomArrangement(walk * 31);
      for (let step = 1; step <= 25; step++) {
        const seed = walk * 1000 + step;
        const result = randomMove(current, seed);
        if (!result) continue;
        kinds.add(result.next.memories.length > current.memories.length ? "gather" : "move");
        if (result.next.memories.length < current.memories.length) kinds.add("putBack");
        expect(problemsOf(result.next), `walk ${walk} step ${step}`).toEqual([]);
        const back = undo(result.next, result.undo);
        if (back) {
          expect(settled(back.next), `walk ${walk} step ${step}`).toEqual(settled(current));
        } else {
          // A chat carried to where it already was: only focus moved, nothing to undo.
          expect(shapes(result.next), `walk ${walk} step ${step}`).toEqual(shapes(current));
        }
        current = result.next;
      }
    }
    expect([...kinds].toSorted()).toEqual(["gather", "move", "putBack"]);
  });
});
