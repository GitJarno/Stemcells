import { describe, expect, it } from "vite-plus/test";

import { serializeWorkspace } from "../tabs/layout";
import { arrangement, frame, LAPTOP, tab, window } from "./fixtures";
import { tear, undo } from "./moves";
import { cascaded, CASCADE } from "./newWindow";
import { welcomeAskiHome } from "./askiHome";
import { askiTab } from "./fixtures";
import { readSnapshot, readUndo, writeTransaction, writeUndo } from "./wire";
import { ASKI_TAB_ID } from "../tabs/askiTab";

const start = arrangement(
  window("a", frame(0), [tab("a1", "x"), tab("a2", "y")]),
  window("b", frame(1000), [tab("b1", "z")]),
);

const snapshot = {
  windows: start.windows.map((w, index) => ({
    ...w,
    workspace: serializeWorkspace(w.workspace),
    version: index + 3,
  })),
  lead: "a",
  memories: [],
  displays: [LAPTOP],
};

describe("wire", () => {
  it("reads the desktop app's snapshot as the arrangement it holds", () => {
    const seen = readSnapshot(snapshot);
    expect(seen.arrangement).toEqual(start);
    expect([...seen.versions]).toEqual([
      ["a", 3],
      ["b", 4],
    ]);
  });

  it("reads a window that hasn't published yet as empty", () => {
    const seen = readSnapshot({
      ...snapshot,
      windows: [{ ...snapshot.windows[0]!, workspace: null }],
    });
    expect(seen.arrangement.windows[0]!.workspace.tabs).toEqual([]);
  });

  it("writes a move with the version of every window it changes or closes", () => {
    const seen = readSnapshot(snapshot);
    const torn = tear(seen.arrangement, "a2", { id: "c", frame: frame(24), display: "laptop" })!;
    const wire = writeTransaction(torn.transaction, seen.versions);
    expect(wire.basis).toEqual({ a: 3 });
    expect(wire.open.map((w) => w.id)).toEqual(["c"]);
    expect(wire.open[0]!.workspace).toEqual(serializeWorkspace(torn.next.windows[0]!.workspace));
    expect(
      readSnapshot({
        ...snapshot,
        windows: [...wire.change, ...wire.open].map((w) => ({ ...w, version: 0 })),
      }).arrangement.windows.map((w) => w.workspace.tabs.map((t) => t.id)),
    ).toEqual([["a1"], ["a2"]]);
  });
});

describe("Move Tab to New Window", () => {
  it("cascades the new window down and right, on the display", () => {
    expect(cascaded(frame(100), [LAPTOP])).toEqual(frame(100 + CASCADE, 100 + CASCADE));
    const atTheEdge = cascaded({ x: 600, y: 240, width: 900, height: 700 }, [LAPTOP]);
    expect(atTheEdge.x + atTheEdge.width).toBeLessThanOrEqual(1512);
    expect(atTheEdge.y + atTheEdge.height).toBeLessThanOrEqual(982);
  });
});

describe("Aski's tab coming home", () => {
  it("goes first in the lead's strip, unless Aski's tab is there already", () => {
    const home = { tabs: [tab("h1", "x")], activeTabId: "h1" };
    const closed = { tabs: [askiTab(), tab("c1", "y")], activeTabId: "c1" };
    const welcomed = welcomeAskiHome(home, closed);
    expect(welcomed.tabs.map((t) => t.id)).toEqual([ASKI_TAB_ID, "h1"]);
    expect(welcomed.activeTabId).toBe("h1");
    expect(welcomeAskiHome(welcomed, closed)).toBe(welcomed);
    expect(welcomeAskiHome(home, { tabs: [tab("c1", "y")], activeTabId: "c1" })).toBe(home);
  });

  it("keeps a move's undo through the desktop app, so Undo Move can take it back", () => {
    const torn = tear(start, "a2", { id: "c", frame: frame(24), display: "laptop" })!;
    const kept = readUndo(JSON.parse(JSON.stringify(writeUndo(torn.undo))))!;
    expect(kept).toEqual(torn.undo);
    expect(undo(torn.next, kept)).toMatchObject({ transaction: { close: ["c"] } });
    expect(readUndo({ before: null, after: null })).toBeNull();
  });
});
