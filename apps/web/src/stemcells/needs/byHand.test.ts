import { describe, expect, it } from "vite-plus/test";

import { movedByHand, takeMovedByHand } from "./byHand";

describe("a Cell moved by the person's hand", () => {
  it("hops once for the move it made, and not for one a minute later", () => {
    movedByHand("waffle", 0);
    expect(takeMovedByHand("waffle", 5_000)).toBe(true);
    // The server's next move of the same Cell isn't the person's.
    expect(takeMovedByHand("waffle", 6_000)).toBe(false);

    movedByHand("pancake", 0);
    expect(takeMovedByHand("pancake", 60_000)).toBe(false);
  });
});
