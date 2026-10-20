import { describe, expect, it } from "vite-plus/test";

import { washBox, washCorners, type Box } from "./washShape";

// A 1000 × 600 slate at (100, 40), split into a left column and a right
// column holding a stack of two, a hairline (1 px) apart, as the slate lays
// them out at fractional widths.
const slate: Box = { left: 100, top: 40, width: 1000, height: 600 };
const left: Box = { left: 100, top: 40, width: 499.5, height: 600 };
const topRight: Box = { left: 600.5, top: 40, width: 499.5, height: 299.5 };
const bottomRight: Box = { left: 600.5, top: 340, width: 499.5, height: 300 };

describe("the drop wash's shape", () => {
  it("rounds a corner only where the pane's corner is the slate's", () => {
    // The bug it prevents: a square outline whose corner the slate's curve cuts off.
    expect(washCorners(bottomRight, slate, 12, 1)).toEqual({
      topLeft: 0,
      topRight: 0,
      bottomRight: 11,
      bottomLeft: 0,
    });
    expect(washCorners(left, slate, 12, 1)).toEqual({
      topLeft: 11,
      topRight: 0,
      bottomRight: 0,
      bottomLeft: 11,
    });
    expect(washCorners(topRight, slate, 12, 1)).toEqual({
      topLeft: 0,
      topRight: 11,
      bottomRight: 0,
      bottomLeft: 0,
    });
  });

  it("rounds all four corners of a pane that fills the slate", () => {
    expect(washCorners(slate, slate, 12, 1)).toEqual({
      topLeft: 11,
      topRight: 11,
      bottomRight: 11,
      bottomLeft: 11,
    });
  });

  it("takes a pane running past the slate as meeting its edge", () => {
    // A page sliding in under a swipe overhangs the slate.
    const sliding: Box = { left: 40, top: 40, width: 1200, height: 600 };
    expect(washCorners(sliding, slate, 12, 1).topLeft).toBe(11);
    expect(washCorners(sliding, slate, 12, 1).bottomRight).toBe(11);
  });

  it("stands the inset inside the pane, in the slate's coordinates", () => {
    expect(washBox(bottomRight, slate, 1)).toEqual({
      left: 501.5,
      top: 301,
      width: 497.5,
      height: 298,
    });
  });
});
