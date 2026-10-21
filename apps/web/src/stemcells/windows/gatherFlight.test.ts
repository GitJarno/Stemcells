import { describe, expect, it } from "vite-plus/test";

import { askiTab, frame, tab, window } from "./fixtures";
import { around, landingTabs, leavingOrder } from "./gatherFlight";

describe("Gather's flight", () => {
  it("flies the nearest window first, and none that is full screen", () => {
    const home = window("home", frame(1000), [tab("h1", "a")]);
    const far = window("far", frame(3000), [tab("f1", "b")]);
    const near = window("near", frame(0), [tab("n1", "c")]);
    const full = { ...window("full", frame(1200), [tab("x1", "d")]), fullScreen: true };
    expect(leavingOrder([far, home, full, near], home).map((w) => w.id)).toEqual(["near", "far"]);
  });

  it("lands a window on its Cells' chips, on Aski's only when that is all it held", () => {
    const both = window("both", frame(0), [askiTab(), tab("b1", "a"), tab("b2", "b")]);
    expect(landingTabs(both)).toEqual(["b1", "b2"]);
    const aski = window("aski", frame(0), [askiTab()]);
    expect(landingTabs(aski)).toEqual(aski.workspace.tabs.map((t) => t.id));
  });

  it("aims at the rect around the chips", () => {
    expect(
      around([
        { x: 10, y: 5, width: 100, height: 24 },
        { x: 114, y: 5, width: 100, height: 24 },
      ]),
    ).toEqual({ x: 10, y: 5, width: 204, height: 24 });
    expect(around([])).toBeNull();
  });
});
