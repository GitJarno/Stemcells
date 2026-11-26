import { describe, expect, it } from "vite-plus/test";

import { enteringX } from "./state";

describe("enteringX", () => {
  it("brings a hidden list in from the side of travel", () => {
    expect(enteringX(0, 0, 1, 2, 20)).toBe(20);
    expect(enteringX(0, 0, 3, 0, 20)).toBe(-20);
  });

  it("carries on from where a list still showing stands, so the latest tap wins without a jump", () => {
    expect(enteringX(0.4, 7, 2, 1, 20)).toBe(7);
  });
});
