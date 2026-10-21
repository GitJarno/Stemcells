import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { serializeWorkspace } from "../tabs/layout";
import type { Arrangement } from "./arrangement";
import type { KeptUndo, WireSnapshot, WireTransaction } from "./bridge";
import { carryStarts } from "./carrying";
import { arrangement, frame, LAPTOP, tab, window } from "./fixtures";
import { closeWindow, tear } from "./moves";
import { undoMove } from "./undoMove";
import { readSnapshot, writeUndo } from "./wire";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The desktop app holding `now`, and the moves Undo Move can take back, oldest first. */
function desktop(now: Arrangement, moves: ReadonlyArray<unknown>) {
  let kept: KeptUndo[] = moves.map((entry, index) => ({ id: index + 1, entry }));
  const commits: WireTransaction[] = [];
  const snapshot = (): WireSnapshot => ({
    windows: now.windows.map((placed) => ({
      ...placed,
      workspace: serializeWorkspace(placed.workspace),
      version: 1,
    })),
    lead: now.lead,
    memories: [],
    displays: [LAPTOP],
  });
  vi.stubGlobal("window", {
    // A move flushes typing first, as the page would before unloading.
    dispatchEvent: () => true,
    stemcellsWindows: {
      snapshot: () => Promise.resolve(snapshot()),
      commit: (transaction: WireTransaction) => {
        commits.push(transaction);
        return Promise.resolve("done");
      },
      undos: () => Promise.resolve(kept.toReversed()),
      dropUndo: (id: number) => {
        kept = kept.filter((each) => each.id !== id);
      },
    },
  });
  return { commits, kept: () => kept.map((each) => each.id) };
}

describe("Undo Move", () => {
  it("takes the latest move back, else forgets it and changes nothing: never an older move", async () => {
    const start = arrangement(
      window("a", frame(0), [tab("a1", "x"), tab("a2", "y")]),
      window("b", frame(1000), [tab("b1", "p")]),
      window("c", frame(2000), [tab("c1", "r")]),
    );
    const torn = tear(start, "a1", { id: "d", frame: frame(300), display: LAPTOP.key })!;
    const closed = closeWindow(torn.next, "b")!;
    // b's chat opened in c since: b can't come back, but the tear still could.
    const c = closed.next.windows.find((placed) => placed.id === "c")!;
    const now = {
      ...closed.next,
      windows: closed.next.windows.map((placed) =>
        placed === c
          ? { ...c, workspace: { ...c.workspace, tabs: [...c.workspace.tabs, tab("c2", "p")] } }
          : placed,
      ),
    };
    const app = desktop(now, [writeUndo(torn.undo), writeUndo(closed.undo)]);

    expect(await undoMove()).toBe("forgotten");
    expect(app.commits).toEqual([]);
    expect(app.kept()).toEqual([1]);

    expect(await undoMove()).toBe("undone");
    expect(app.commits.map((commit) => commit.undoes)).toEqual([1]);
    expect(app.commits[0]!.close).toEqual(["d"]);
  });

  it("waits while a carry is in the hand", async () => {
    const start = arrangement(window("a", frame(0), [tab("a1", "x"), tab("a2", "y")]));
    const torn = tear(start, "a1", { id: "d", frame: frame(300), display: LAPTOP.key })!;
    const app = desktop(torn.next, [writeUndo(torn.undo)]);
    const carried = carryStarts();
    expect(await undoMove()).toBe("none");
    expect(app.commits).toEqual([]);
    expect(app.kept()).toEqual([1]);
    carried();
    expect(await undoMove()).toBe("undone");
  });

  it("does nothing with no move to take back", async () => {
    const app = desktop(
      readSnapshot({ windows: [], lead: null, memories: [], displays: [] }).arrangement,
      [],
    );
    expect(await undoMove()).toBe("none");
    expect(app.commits).toEqual([]);
  });
});
