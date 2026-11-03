import { describe, expect, it } from "vite-plus/test";

import { carriedOffset, enteringX } from "./state";

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
