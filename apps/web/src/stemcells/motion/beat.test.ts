import { describe, expect, it } from "vite-plus/test";

import { BEAT_CURVE, beatStart, sweepFrames } from "./beat";

describe("the room's beat", () => {
  it("keeps every loop on the wall clock, whenever it starts", () => {
    const cycle = 4200;
    const origin = 1_700_000_123_456;
    for (const now of [0, 987, 55_555]) {
      const currentTime = now - beatStart(cycle, origin);
      expect((currentTime - (origin + now)) % cycle).toBeCloseTo(0);
    }
  });

  it("crosses in the pass and holds at the far end through the rest", () => {
    const frames = sweepFrames(-10, 300, 3200 / 4200, "skewX(-0.4rad)");
    expect(frames.map((frame) => frame.offset)).toEqual([0, 3200 / 4200, 1]);
    expect(frames[0]).toMatchObject({
      transform: "translateX(-10px) skewX(-0.4rad)",
      easing: BEAT_CURVE,
    });
    expect(frames[1]!.transform).toBe("translateX(300px) skewX(-0.4rad)");
    expect(frames[2]!.transform).toBe(frames[1]!.transform);
  });
});
