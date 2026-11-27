import { describe, expect, it } from "vite-plus/test";

import { railButtons, railCentre, railStyle } from "./railPlace";

const unfolded = {
  verticalBarEdge: "right",
  horizontalSizeClass: "regular",
  safeArea: { left: 0, right: 80 },
};

describe("our buttons in the Duo's rail", () => {
  it("count a header's buttons, not its spacers or the keyboard's dismiss", () => {
    const items = [
      { type: "item", id: "compose" },
      { type: "spacer", id: "compose-group" },
      { type: "item", id: "code" },
      { type: "item", id: "dismiss-keyboard" },
    ];
    expect(railButtons(items, false)).toBe(2);
    expect(railButtons(items, true)).toBe(3);
  });

  it("stand Aski right after the top group, however many buttons it holds", () => {
    const aski = (top: number | null) =>
      railCentre({ regular: true, windowHeight: 703, top, index: 0, ours: 1, size: 52 });
    // The chat's two (new chat, code), as measured.
    expect(aski(2)).toBe(156 + 2 * 63);
    // Usage's one (its filter): a place higher, not a gap below it.
    expect(aski(1)).toBe(156 + 63);
    expect(aski(0)).toBe(156);
    expect(aski(null)).toBe(aski(2));
  });

  it("stand the trophy first and Aski after it, never into the tabs", () => {
    const at = (index: number, top: number) =>
      railCentre({ regular: true, windowHeight: 703, top, index, ours: 2, size: 52 });
    expect([at(0, 1), at(1, 1)]).toEqual([156 + 63, 156 + 2 * 63]);
    const tabs = 703 * 0.649 - 14 - 26;
    expect(at(1, 6)).toBe(tabs);
    expect(at(0, 6)).toBe(tabs - 63);
  });

  it("folded, follow the group as it stands there: higher, and closer", () => {
    const at = (index: number, top: number) =>
      railCentre({ regular: false, windowHeight: 684, top, index, ours: 2, size: 52 });
    // Measured: new chat at 198, search at 258, the tabs from 444.
    expect([at(0, 2), at(1, 2)]).toEqual([198 + 2 * 60, 198 + 3 * 60]);
    expect(at(1, 6)).toBe(684 * 0.649 - 14 - 26);
  });

  it("place nothing in the rail where there is none, or none wide enough", () => {
    const place = (metrics: Parameters<typeof railStyle>[0]["metrics"]) =>
      railStyle({ metrics, window: { height: 703 }, top: 1, index: 0, ours: 1, size: 52 });
    expect(place(null)).toBeNull();
    expect(place({ ...unfolded, verticalBarEdge: "none" })).toBeNull();
    expect(place({ ...unfolded, safeArea: { left: 0, right: 40 } })).toBeNull();
    expect(place(unfolded)).toEqual({ right: (80 + 14 - 52) / 2, top: 156 + 63 - 26 });
  });
});
