import { describe, expect, it } from "vite-plus/test";

import { carriedOffset, enteringX, stageAfterSwipe } from "./state";

describe("carriedOffset", () => {
  it("keeps the shared header where the last list left it while any of it shows", () => {
    expect(carriedOffset(-62, 400, -62, 240)).toBe(-62);
    expect(carriedOffset(58, 400, -62, 240)).toBe(58);
    expect(carriedOffset(-92, 400, -62, 240)).toBe(-62);
  });

  it("opens a list at its own place once the header is gone, the header just out of sight", () => {
    expect(carriedOffset(900, 400, -62, 240)).toBe(400);
    expect(carriedOffset(900, -62, -62, 240)).toBe(178);
    expect(carriedOffset(178, 60, -62, 240)).toBe(178);
  });
});

describe("enteringX", () => {
  it("brings a hidden list in from the side of travel", () => {
    expect(enteringX(0, 0, 1, 2, 20)).toBe(20);
    expect(enteringX(0, 0, 3, 0, 20)).toBe(-20);
  });

  it("carries on from where a list still showing stands, so the latest tap wins without a jump", () => {
    expect(enteringX(0.4, 7, 2, 1, 20)).toBe(7);
  });
});

describe("stageAfterSwipe", () => {
  const stages = ["needs", "working", "landed", "settled"];

  it("turns left to the next stage and right to the one before, a flick sooner", () => {
    expect(stageAfterSwipe(stages, "working", -60, 0)).toBe("landed");
    expect(stageAfterSwipe(stages, "working", 60, 0)).toBe("needs");
    expect(stageAfterSwipe(stages, "working", -20, -900)).toBe("landed");
  });

  it("stays short of a turn, on a flick back against the swipe, and past either end", () => {
    expect(stageAfterSwipe(stages, "working", -20, 0)).toBeNull();
    expect(stageAfterSwipe(stages, "working", -20, 900)).toBeNull();
    expect(stageAfterSwipe(stages, "needs", 80, 0)).toBeNull();
    expect(stageAfterSwipe(stages, "settled", -80, 0)).toBeNull();
  });
});
