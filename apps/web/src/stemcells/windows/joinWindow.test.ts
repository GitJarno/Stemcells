import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ASKI_TAB_ID } from "../tabs/askiTab";
import { serializeWorkspace } from "../tabs/layout";
import type { WireSnapshot, WireTransaction } from "./bridge";
import { arrangement, askiTab, frame, LAPTOP, tab, window } from "./fixtures";
import { readSnapshot } from "./wire";

/** The module as window `b` loads it, beside window `a`, which holds Aski. */
async function load() {
  const start = arrangement(
    window("a", frame(0), [askiTab(), tab("a1", "x")]),
    window("b", frame(1000), [tab("b1", "y")]),
  );
  const snapshot: WireSnapshot = {
    windows: start.windows.map((w) => ({
      ...w,
      workspace: serializeWorkspace(w.workspace),
      version: 1,
    })),
    lead: "a",
    memories: [],
    displays: [LAPTOP],
  };
  const commits: WireTransaction[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    stemcellsWindows: {
      boot: { id: "b", lead: false, workspace: null, others: [] },
      snapshot: async () => snapshot,
      commit: async (transaction: WireTransaction) => {
        commits.push(transaction);
        return "done";
      },
    },
  });
  vi.resetModules();
  const { bringAskiHere } = await import("./joinWindow");
  return { bringAskiHere, commits, snapshot };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("going to Aski in a window that doesn't hold it", () => {
  it("brings Aski's tab here, first and on stage, and the window it left keeps its Cells", async () => {
    const { bringAskiHere, commits, snapshot } = await load();
    expect(await bringAskiHere()).toBe(true);
    const [move] = commits;
    expect(move!.front).toBe("b");
    expect(move!.close).toEqual([]);
    const after = readSnapshot({
      ...snapshot,
      windows: move!.change.map((w) => ({ ...w, version: 2 })),
    }).arrangement;
    const workspaceOf = (id: string) => after.windows.find((w) => w.id === id)!.workspace;
    expect(workspaceOf("b").tabs.map((t) => t.id)).toEqual([ASKI_TAB_ID, "b1"]);
    expect(workspaceOf("b").activeTabId).toBe(ASKI_TAB_ID);
    expect(workspaceOf("a").tabs.map((t) => t.id)).toEqual(["a1"]);
  });
});
