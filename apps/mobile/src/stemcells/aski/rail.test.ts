import { describe, expect, it } from "vite-plus/test";

import { railCentre, railStyle } from "./railPlace";

const rail = { verticalBarEdge: "right", safeArea: { left: 0, right: 80 } };
/** Where the tab group starts, measured: 444 pt down the closed Duo's 684. */
const tabs = (height: number) => height * 0.649;

describe("our buttons in the Duo's rail", () => {
  it("stand Aski just over the tabs, wherever UIKit puts the buttons above", () => {
    const centre = railCentre({ windowHeight: 684, index: 0, ours: 1, size: 52 });
    expect(centre + 26).toBe(tabs(684) - 14);
    // Clear of a top group of three (198, 258, 318 pt, 46 across) on the closed Duo.
    expect(centre - 26).toBeGreaterThan(318 + 23);
  });

  it("stand the trophy over Aski, a button's pitch above", () => {
    const at = (index: number) => railCentre({ windowHeight: 703, index, ours: 2, size: 52 });
    expect(at(1)).toBe(tabs(703) - 14 - 26);
    expect(at(0)).toBe(at(1) - 60);
  });

  it("place nothing in the rail where there is none, or none wide enough", () => {
    const place = (metrics: Parameters<typeof railStyle>[0]["metrics"]) =>
      railStyle({ metrics, window: { height: 703 }, index: 0, ours: 1, size: 52 });
    expect(place(null)).toBeNull();
    expect(place({ ...rail, verticalBarEdge: "none" })).toBeNull();
    expect(place({ ...rail, safeArea: { left: 0, right: 40 } })).toBeNull();
    expect(place(rail)).toEqual({ right: (80 + 14 - 52) / 2, top: tabs(703) - 14 - 52 });
  });
});
