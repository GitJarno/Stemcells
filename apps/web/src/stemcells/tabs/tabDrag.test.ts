import { describe, expect, it } from "vite-plus/test";

import { clampOffset, nearestSlot, restingOffsets, SWAP_HYSTERESIS } from "./tabDrag";

// Three 100 px tabs, 4 px apart: slots start at 0, 104 and 208.
const geometry = { widths: [100, 100, 100], gap: 4, from: 0 };
const midpoint = 52;

describe("dragging a tab", () => {
  it("holds its slot until it is past the midpoint by the hysteresis", () => {
    expect(nearestSlot(geometry, midpoint + SWAP_HYSTERESIS - 1, 0)).toBe(0);
    expect(nearestSlot(geometry, midpoint + SWAP_HYSTERESIS + 1, 0)).toBe(1);
  });

  it("swaps back only once it is back past the midpoint by the hysteresis", () => {
    expect(nearestSlot(geometry, midpoint - SWAP_HYSTERESIS + 1, 1)).toBe(1);
    expect(nearestSlot(geometry, midpoint - SWAP_HYSTERESIS - 1, 1)).toBe(0);
  });

  it("jumps straight to the nearest slot on a long move", () => {
    expect(nearestSlot(geometry, 208, 0)).toBe(2);
  });

  it("stays inside the strip", () => {
    expect(clampOffset(geometry, -50)).toBeCloseTo(0);
    expect(clampOffset(geometry, 500)).toBe(208);
    expect(clampOffset({ ...geometry, from: 2 }, -500)).toBe(-208);
  });

  it("the tabs it passes move into the slots it left", () => {
    expect(restingOffsets(geometry, 0)).toEqual([0, 0, 0]);
    expect(restingOffsets(geometry, 2)).toEqual([208, -104, -104]);
  });

  it("slots follow the widths when tabs differ in size", () => {
    const uneven = { widths: [60, 140, 100], gap: 4, from: 2 };
    // The 100 px tab placed first pushes the others right by its width and a gap.
    expect(restingOffsets(uneven, 0)).toEqual([104, 104, -208]);
  });
});
