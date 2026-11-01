import { describe, expect, it } from "vite-plus/test";

import { carriedOffset, enteringX } from "./state";

describe("carriedOffset", () => {
  it("keeps the shared header where the last list left it while any of it shows", () => {
    expect(carriedOffset(0, 400, 240)).toBe(0);
    expect(carriedOffset(120, 400, 240)).toBe(120);
    expect(carriedOffset(-30, 400, 240)).toBe(0);
  });

  it("opens a list at its own place once the header is gone, the header just out of sight", () => {
    expect(carriedOffset(900, 400, 240)).toBe(400);
    expect(carriedOffset(900, 0, 240)).toBe(240);
    expect(carriedOffset(240, 60, 240)).toBe(240);
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
