import { describe, expect, it } from "vite-plus/test";

import {
  borderValue,
  DETENT,
  detent,
  HOLD,
  moveBorder,
  NUDGE,
  nudgeBorder,
  sharePair,
} from "./split";

const pair = { before: 400, after: 400, floorBefore: 160, floorAfter: 160 };

describe("a border dragged between two neighbours", () => {
  it("moves 1:1 with the pointer, the pair's length kept", () => {
    expect(moveBorder(pair, 120)).toEqual({ before: 520, after: 280 });
    expect(moveBorder(pair, -120)).toEqual({ before: 280, after: 520 });
  });

  it("holds at even near it, from either side", () => {
    expect(moveBorder(pair, HOLD)).toEqual({ before: 400, after: 400 });
    expect(moveBorder({ ...pair, before: 430, after: 370 }, -27)).toEqual({
      before: 400,
      after: 400,
    });
    expect(moveBorder(pair, DETENT)).toEqual({ before: 420, after: 380 });
    expect(moveBorder({ ...pair, before: 600, after: 200 }, -8)).toEqual({
      before: 592,
      after: 208,
    });
  });

  it("lets go of even softly: the border never jumps, and catches the pointer up", () => {
    // Pixel by pixel out of the hold, the border moves on without a jump,
    // never back, and is on the pointer again at the detent's edge.
    let last = detent(0);
    for (let offset = 0.25; offset <= DETENT + 4; offset += 0.25) {
      const at = detent(offset);
      expect(at).toBeGreaterThanOrEqual(last);
      expect(at - last).toBeLessThan(0.25 * 2);
      expect(at).toBeLessThanOrEqual(offset);
      expect(detent(-offset)).toBeCloseTo(-at, 9);
      last = at;
    }
    expect(detent(DETENT)).toBe(DETENT);
    expect(detent(DETENT + 3)).toBe(DETENT + 3);
  });

  it("stops at either neighbour's floor", () => {
    expect(moveBorder(pair, 1000)).toEqual({ before: 640, after: 160 });
    expect(moveBorder(pair, -1000)).toEqual({ before: 160, after: 640 });
  });

  it("leaves neighbours already under their floors where they are", () => {
    const cramped = { before: 150, after: 150, floorBefore: 160, floorAfter: 160 };
    expect(moveBorder(cramped, 40)).toEqual({ before: 150, after: 150 });
  });

  // The press found a border 3 px off even and the detent pulled it there at
  // once; a neighbour under its floor jumped up to it.
  it("moves nothing at the press, wherever it finds the border", () => {
    for (const before of [400, 403, 410, 419, 430, 600]) {
      expect(moveBorder({ ...pair, before, after: 800 - before }, 0).before).toBe(before);
    }
    // Found inside the detent but off even, it follows the pointer 1:1.
    expect(moveBorder({ ...pair, before: 403, after: 397 }, -2)).toEqual({
      before: 401,
      after: 399,
    });
    const under = { before: 120, after: 680, floorBefore: 160, floorAfter: 160 };
    expect(moveBorder(under, 0)).toEqual({ before: 120, after: 680 });
    // Under its floor, a neighbour may grow, not shrink.
    expect(moveBorder(under, -30)).toEqual({ before: 120, after: 680 });
    expect(moveBorder(under, 30)).toEqual({ before: 150, after: 650 });
  });
});

describe("a border nudged by the arrow keys", () => {
  it("moves by a nudge, and stops at even on its way across", () => {
    expect(nudgeBorder(pair, 1)).toEqual({ before: 400 + NUDGE, after: 400 - NUDGE });
    expect(nudgeBorder({ ...pair, before: 395, after: 405 }, 1)).toEqual({
      before: 400,
      after: 400,
    });
    expect(nudgeBorder({ ...pair, before: 410, after: 390 }, -1)).toEqual({
      before: 400,
      after: 400,
    });
  });

  it("stops at either neighbour's floor", () => {
    expect(nudgeBorder({ ...pair, before: 170, after: 630 }, -1)).toEqual({
      before: 160,
      after: 640,
    });
  });
});

describe("a border's shares", () => {
  it("only its two neighbours share out what they had between them", () => {
    expect(sharePair([1, 1, 1], 1, 300, 100)).toEqual([1, 1.5, 0.5]);
  });

  it("reads as the first neighbour's part of the pair, 50 at even", () => {
    expect(borderValue(1, 1)).toBe(50);
    expect(borderValue(1.5, 0.5)).toBe(75);
  });
});
