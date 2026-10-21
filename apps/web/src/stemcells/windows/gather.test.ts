import { describe, expect, it } from "vite-plus/test";

import { ASKI_TAB_ID } from "../tabs/askiTab";
import { closeTab, openTab } from "../tabs/layout";
import {
  applyTransaction,
  displaySetKey,
  flatTabs,
  problemsOf,
  windowById,
  type Arrangement,
} from "./arrangement";
import {
  arrangement,
  askiTab,
  frame,
  LAPTOP,
  MONITOR,
  randomArrangement,
  settled,
  tab,
  window,
} from "./fixtures";
import { displaysChanged, gather, gatherButton, putBack } from "./gather";
import { tear } from "./moves";

const BOTH = displaySetKey([LAPTOP, MONITOR]);
const tabIds = (a: Arrangement, id: string) =>
  windowById(a, id)?.workspace.tabs.map((t) => t.id) ?? null;

/** Three windows: one on the laptop, two on the monitor (the right one holds Aski). */
function desk(): Arrangement {
  return arrangement(
    window("mid", frame(1600), [tab("m1", "a"), tab("m2", "b")], MONITOR.key),
    window("left", frame(100), [tab("l1", "c")], LAPTOP.key),
    window("right", frame(2600), [askiTab(), tab("r1", "d")], MONITOR.key),
  );
}

describe("gather", () => {
  it("pulls every tab into the window pressed in: its own first, then the others left to right, Aski first", () => {
    const result = gather(desk(), "mid", BOTH)!;
    expect(result.next.windows.map((w) => w.id)).toEqual(["mid"]);
    expect(tabIds(result.next, "mid")).toEqual([ASKI_TAB_ID, "m1", "m2", "l1", "r1"]);
    expect(windowById(result.next, "mid")!.workspace.activeTabId).toBe("m1");
    expect(result.transaction.close.toSorted()).toEqual(["left", "right"]);
  });

  it("remembers where every window was, for this display set", () => {
    const [memory] = gather(desk(), "mid", BOTH)!.next.memories;
    expect(memory!.displays).toBe(BOTH);
    expect(memory!.home).toBe("mid");
    expect(memory!.windows.find((w) => w.id === "right")).toMatchObject({
      frame: frame(2600),
      tabs: [ASKI_TAB_ID, "r1"],
    });
  });

  it("makes the home window the lead when the lead closes", () => {
    const start = { ...desk(), lead: "left" };
    expect(gather(start, "mid", BOTH)!.next.lead).toBe("mid");
  });

  it("has nothing to gather in one window", () => {
    expect(gather(arrangement(window("a", frame(0), [tab("a1", "x")])), "a", BOTH)).toBeNull();
  });
});

describe("putBack", () => {
  it("puts every window back where it was with its tabs", () => {
    const start = desk();
    const gathered = gather(start, "mid", BOTH)!;
    const back = putBack(gathered.next, gathered.next.memories[0]!)!;
    expect(settled(back.next)).toEqual(settled(start));
    expect(back.next.windows[0]!.id).toBe("mid");
    expect(back.next.memories).toEqual([]);
  });

  it("skips a tab closed since, and keeps a tab opened since at home", () => {
    const gathered = gather(desk(), "mid", BOTH)!.next;
    const mid = windowById(gathered, "mid")!;
    const changed = closeTab(
      openTab(mid.workspace, { tab: "new", row: "nr", column: "nc", pane: "np" }, null),
      "l1",
    );
    const now = { ...gathered, windows: [{ ...mid, workspace: changed }] };
    const back = putBack(now, now.memories[0]!)!;
    expect(back.next.windows.map((w) => w.id).toSorted()).toEqual(["mid", "right"]);
    expect(tabIds(back.next, "mid")).toEqual(["m1", "m2", "new"]);
    expect(tabIds(back.next, "right")).toEqual([ASKI_TAB_ID, "r1"]);
  });

  it("takes a remembered tab from whichever window holds it now", () => {
    const gathered = gather(desk(), "mid", BOTH)!.next;
    const torn = tear(gathered, "r1", { id: "elsewhere", frame: frame(300), display: LAPTOP.key })!;
    const back = putBack(torn.next, torn.next.memories[0]!)!;
    expect(tabIds(back.next, "right")).toEqual([ASKI_TAB_ID, "r1"]);
    expect(windowById(back.next, "elsewhere")).toBeNull();
    expect(problemsOf(back.next)).toEqual([]);
  });

  it("is a round trip for any arrangement", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const start = randomArrangement(seed);
      const home = start.windows[seed % start.windows.length]!.id;
      const gathered = gather(start, home, BOTH);
      if (!gathered) continue;
      expect(problemsOf(gathered.next), `seed ${seed}`).toEqual([]);
      const back = putBack(gathered.next, gathered.next.memories[0]!)!;
      expect(settled(back.next), `seed ${seed}`).toEqual(settled(start));
      expect(applyTransaction(gathered.next, back.transaction)).toEqual(back.next);
    }
  });
});

describe("the button", () => {
  it("offers Gather over two windows, Put back over one with a memory, else nothing", () => {
    const start = desk();
    expect(gatherButton(start, BOTH)).toBe("gather");
    const gathered = gather(start, "mid", BOTH)!.next;
    expect(gatherButton(gathered, BOTH)).toBe("putBack");
    expect(gatherButton(gathered, displaySetKey([LAPTOP]))).toBeNull();
    expect(gatherButton({ ...gathered, memories: [] }, BOTH)).toBeNull();
  });
});

describe("the phone's order", () => {
  it("is the lead window's tabs, then each other window's left to right", () => {
    expect(flatTabs({ ...desk(), lead: "right" }).map((t) => t.id)).toEqual([
      ASKI_TAB_ID,
      "r1",
      "l1",
      "m1",
      "m2",
    ]);
  });
});

describe("displaysChanged", () => {
  it("gathers an unplugged display's windows into the front window left, and puts them back on its return", () => {
    const start = desk();
    const unplugged = displaysChanged(start, [LAPTOP, MONITOR], [LAPTOP])!;
    expect(unplugged.next.windows.map((w) => w.id)).toEqual(["left"]);
    expect(tabIds(unplugged.next, "left")).toEqual([ASKI_TAB_ID, "l1", "m1", "m2", "r1"]);
    expect(unplugged.next.memories[0]).toMatchObject({ displays: BOTH, automatic: true });
    expect(gatherButton(unplugged.next, displaySetKey([LAPTOP]))).toBeNull();

    const replugged = displaysChanged(unplugged.next, [LAPTOP], [LAPTOP, MONITOR])!;
    expect(settled(replugged.next)).toEqual(settled(start));
  });

  it("moves a lone window to the display left, and back on return", () => {
    const start = arrangement(window("a", frame(2000, 0), [tab("a1", "x")], MONITOR.key));
    const unplugged = displaysChanged(start, [LAPTOP, MONITOR], [LAPTOP])!;
    const moved = windowById(unplugged.next, "a")!;
    expect(moved.display).toBe(LAPTOP.key);
    expect(moved.frame.x + moved.frame.width).toBeLessThanOrEqual(1512);
    const replugged = displaysChanged(unplugged.next, [LAPTOP], [LAPTOP, MONITOR])!;
    expect(windowById(replugged.next, "a")!.frame).toEqual(frame(2000, 0));
  });

  it("keeps a frame inside its display at launch", () => {
    const start = arrangement(window("a", frame(1000, 600, 900, 700), [tab("a1", "x")]));
    const relaunched = displaysChanged(start, [LAPTOP], [LAPTOP])!;
    expect(windowById(relaunched.next, "a")!.frame).toEqual(frame(612, 282, 900, 700));
  });

  it("is no change when every window is where it can be", () => {
    expect(displaysChanged(desk(), [LAPTOP, MONITOR], [LAPTOP, MONITOR])).toBeNull();
  });
});
