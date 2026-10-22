import { describe, expect, it } from "vite-plus/test";

import { washBox, type Box } from "./washShape";

// A 1000 × 600 slate at (100, 40); a pane at its bottom right.
const slate: Box = { left: 100, top: 40, width: 1000, height: 600 };
const bottomRight: Box = { left: 600.5, top: 340, width: 499.5, height: 300 };

describe("the drop wash's place", () => {
  it("stands the inset inside the pane, in the slate's coordinates", () => {
    expect(washBox(bottomRight, slate, 6)).toEqual({
      left: 506.5,
      top: 306,
      width: 487.5,
      height: 288,
    });
  });

  it("never turns inside out over a pane narrower than its inset", () => {
    expect(washBox({ left: 100, top: 40, width: 8, height: 8 }, slate, 6)).toMatchObject({
      width: 0,
      height: 0,
    });
  });
});
