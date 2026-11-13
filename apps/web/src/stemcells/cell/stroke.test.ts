import { expect, it } from "vite-plus/test";

import { STROKE, type Stroking, stroking } from "./stroke.ts";

/** Whether the hand passing through `xs`, one each `step` seconds, strokes. */
function strokes(xs: readonly number[], step = 0.05): boolean {
  let state: Stroking | undefined;
  let seconds = 0;
  for (const x of xs) {
    const { next, stroked } = stroking(state, x, seconds);
    if (stroked) return true;
    state = next;
    seconds += step;
  }
  return false;
}

it("is three turns of the hand, each after a real run, within a moment", () => {
  expect(strokes([0, 8, 16, 8, 0, 8, 16, 8])).toBe(true);
  // Passing over once, or back once, is not a stroke.
  expect(strokes([0, 8, 16, 24, 32])).toBe(false);
  expect(strokes([0, 8, 16, 8, 0])).toBe(false);
});

it("is not a hand that trembles in place, nor one that takes its time", () => {
  expect(strokes([10, 11, 10, 11, 10, 11, 10, 11, 10])).toBe(false);
  expect(strokes([0, 8, 16, 8, 0, 8, 16, 8], STROKE.within / 3)).toBe(false);
});
