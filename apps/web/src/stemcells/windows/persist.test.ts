import { describe, expect, it } from "vite-plus/test";

import { gather } from "./gather";
import { arrangement, frame, LAPTOP, MONITOR, tab, window } from "./fixtures";
import { parseWindows, serializeWindows, singleWindow } from "./persist";

const displays = [LAPTOP, MONITOR];

describe("persist", () => {
  it("keeps windows, the lead, memories and displays across a launch", () => {
    const start = gather(
      arrangement(
        window("a", frame(0), [tab("a1", "x")]),
        window("b", { ...frame(1600), y: -100 }, [tab("b1", "y", "z")], MONITOR.key),
      ),
      "a",
      "laptop|monitor",
    )!.next;
    const stored = JSON.parse(JSON.stringify(serializeWindows({ arrangement: start, displays })));
    expect(parseWindows(stored)).toEqual({ arrangement: start, displays });
  });

  it("drops what doesn't read, and a window left with no tabs unless it leads", () => {
    const stored = {
      version: 1,
      lead: "gone",
      windows: [
        { id: "empty", frame: frame(0), display: "laptop", workspace: { version: 1, tabs: [] } },
        { id: "bad-frame", frame: { x: 0, y: 0, width: 0, height: 10 }, display: "laptop" },
        {
          id: "a",
          frame: frame(10),
          display: "laptop",
          workspace: { version: 1, tabs: [tab("a1", "x")], activeTabId: "a1" },
        },
      ],
      memories: [{ displays: "laptop", home: "a", windows: [{ id: "b" }] }],
      displays: [LAPTOP, { key: "broken" }],
    };
    const parsed = parseWindows(stored)!;
    expect(parsed.arrangement.windows.map((w) => w.id)).toEqual(["a"]);
    expect(parsed.arrangement.lead).toBe("a");
    expect(parsed.arrangement.memories).toEqual([]);
    expect(parsed.displays).toEqual([LAPTOP]);
  });

  it("reads nothing from another version or no windows, so the first window starts from the tab store", () => {
    expect(parseWindows({ version: 2, windows: [] })).toBeNull();
    expect(parseWindows({ version: 1, windows: [] })).toBeNull();
    expect(parseWindows(null)).toBeNull();
  });

  it("starts with one leading window", () => {
    const workspace = { tabs: [tab("a1", "x")], activeTabId: "a1" };
    expect(singleWindow("a", frame(0), "laptop", workspace)).toEqual(
      arrangement({ id: "a", frame: frame(0), display: "laptop", fullScreen: false, workspace }),
    );
  });
});
