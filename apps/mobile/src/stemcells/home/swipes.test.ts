import { describe, expect, it } from "vite-plus/test";

import { AT_REST, type Flick, reach, sampled } from "./swipes";

/** The full swipe on a phone row starts 215 pt out (58% of a 370 pt row). */
const FULL = 215;

/** A finger's places, one every `frame` ms from `start`. */
function drag(places: readonly number[], frame = 8, start = 1_000): Flick {
  return places.reduce((flick, x, index) => sampled(flick, x, start + index * frame), AT_REST);
}

describe("a row let go mid-swipe", () => {
  it("reaches the full swipe on a quick flick well short of it", () => {
    const flick = drag([10, 22, 36, 52, 70, 90]);
    expect(reach(flick, 90, flick.t + 8)).toBeGreaterThanOrEqual(FULL);
  });

  it("stays short on a slow drag, so the button only shows", () => {
    const flick = drag([60, 62, 64, 66, 68, 70]);
    expect(reach(flick, 70, flick.t + 8)).toBeLessThan(FULL);
  });

  it("carries nowhere once the finger has stopped before letting go", () => {
    const flick = drag([10, 30, 60, 100, 140, 180]);
    expect(reach(flick, 180, flick.t + 120)).toBe(180);
  });

  it("falls short when flicked back toward the start", () => {
    const flick = drag([200, 190, 170, 145, 120]);
    expect(reach(flick, 120, flick.t + 8)).toBeLessThan(FULL);
  });

  it("reads a swipe after a pause from rest, not from the last one", () => {
    const first = drag([0, 40, 80, 120]);
    expect(sampled(first, 125, first.t + 500).v).toBe(0);
  });
});
