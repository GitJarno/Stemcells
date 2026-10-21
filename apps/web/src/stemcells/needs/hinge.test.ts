import { describe, expect, it } from "vite-plus/test";

import { hingeAcross } from "./hinge";

const page = { left: 56, top: 36, width: 1336, height: 856 };

describe("where the hinge crosses Aski's page", () => {
  it("splits the page at the hinge when two screens sit side by side", () => {
    const screens = [
      { left: 0, top: 0, right: 690, bottom: 900 },
      { left: 710, top: 0, right: 1400, bottom: 900 },
    ];
    expect(hingeAcross(page, screens)).toEqual({ axis: "side", start: 634, end: 654 });
  });

  it("splits it top and bottom when the screens are stacked", () => {
    const screens = [
      { left: 0, top: 0, right: 1400, bottom: 450 },
      { left: 0, top: 450, right: 1400, bottom: 900 },
    ];
    expect(hingeAcross(page, screens)).toEqual({ axis: "stacked", start: 414, end: 414 });
  });

  it("keeps one screen's layout when the hinge misses the page or only clips its edge", () => {
    const screens = [
      { left: 0, top: 0, right: 700, bottom: 900 },
      { left: 700, top: 0, right: 1400, bottom: 900 },
    ];
    expect(hingeAcross({ left: 720, top: 36, width: 672, height: 856 }, screens)).toBeNull();
    expect(hingeAcross({ left: 600, top: 36, width: 792, height: 856 }, screens)).toBeNull();
    expect(hingeAcross(page, screens.slice(0, 1))).toBeNull();
  });
});
