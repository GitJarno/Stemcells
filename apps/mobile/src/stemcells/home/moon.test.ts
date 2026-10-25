import { describe, expect, it } from "vite-plus/test";

import { moonPhase } from "./moon";

describe("the moon over the Asleep tab", () => {
  it("is full and new when the sky's is", () => {
    // Full on 2024-01-25 17:54 UTC, new on 2024-02-09 22:59 UTC.
    expect(moonPhase(Date.UTC(2024, 0, 25, 17, 54))).toBeCloseTo(0.5, 1);
    const fresh = moonPhase(Date.UTC(2024, 1, 9, 22, 59));
    expect(Math.min(fresh, 1 - fresh)).toBeLessThan(0.03);
  });
});
