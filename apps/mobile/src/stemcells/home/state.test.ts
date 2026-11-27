import { describe, expect, it } from "vite-plus/test";

import { enteringX, pillBottom } from "./state";

describe("enteringX", () => {
  it("brings a hidden list in from the side of travel", () => {
    expect(enteringX(0, 0, 1, 2, 20)).toBe(20);
    expect(enteringX(0, 0, 3, 0, 20)).toBe(-20);
  });

  it("carries on from where a list still showing stands, so the latest tap wins without a jump", () => {
    expect(enteringX(0.4, 7, 2, 1, 20)).toBe(7);
  });
});

describe("pillBottom", () => {
  // rest 120 (over a resting search), keyboard 300 when open.
  it.each([
    ["rests with no keyboard", 6, 0, 0, 120],
    ["stands level with the composer's foot over the keyboard", 6, 300, 1, 306],
    ["stands over a search riding the keyboard", 64, 300, 1, 364],
    ["moves in step with the keyboard, as the composer does", 6, 150, 0.5, 213],
    ["keeps its rest over a keyboard too short to reach it", 6, 55, 1, 120],
  ])("%s", (_, above, keyboard, progress, bottom) => {
    expect(pillBottom(120, above, keyboard, progress)).toBe(bottom);
  });
});
