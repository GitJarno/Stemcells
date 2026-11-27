import { describe, expect, it } from "vite-plus/test";

import { poseAt } from "./acts.ts";

describe("the model's acts", () => {
  it("pulls the laptop out and lifts off to write", () => {
    const start = poseAt("writing", 100, 0);
    expect(start.laptop).toBeLessThan(0.2);
    expect(start.lift).toBeLessThan(0.02);
    const working = poseAt("writing", 1500, 0);
    expect(working.laptop).toBeGreaterThan(0.95);
    expect(working.lid).toBeGreaterThan(0.95);
    expect(working.glow).toBeGreaterThan(0.9);
    expect(working.lift).toBeGreaterThan(0.12);
    expect(working.arms).toEqual([expect.closeTo(1, 1), expect.closeTo(1, 1)]);
  });

  it("comes down and half shuts the lid to ask, keeping the laptop out", () => {
    const asking = poseAt("asking", 1500, 0, "writing");
    expect(asking.lift).toBeLessThan(0.03);
    expect(asking.laptop).toBeGreaterThan(0.95);
    expect(asking.lid).toBeLessThan(0.45);
    expect(["ask", "hidden"]).toContain(asking.eyes);
  });

  it("puts the laptop away and hops when it lands, then rests", () => {
    expect(poseAt("landed", 600, 0, "writing").lift).toBeGreaterThan(0.1);
    expect(poseAt("landed", 600, 0, "writing").eyes).toBe("glad");
    const after = poseAt("landed", 3600, 0, "writing");
    expect(after.laptop).toBeLessThan(0.02);
    expect(after.lift).toBeLessThan(0.02);
    expect(after.arms[0]).toBeLessThan(0.05);
    expect(after.squash).toBeCloseTo(1, 1);
  });

  it("keeps a grown Cell's arms when it rests, and a newborn's away", () => {
    expect(poseAt("rest", 1000, 1).arms[0]).toBeGreaterThan(0.9);
    expect(poseAt("rest", 1000, 0).arms[0]).toBeLessThan(0.05);
  });
});
