import { describe, expect, it } from "vite-plus/test";

import { footLift } from "./foot";

// An 844-point window with 59 and 34 point insets; the tallest sheet's content is 775 tall,
// so the part-height detent (0.62) shows 0.62 × (775 − 34) + 34 = 493.42 of it.
const phone = { window: 844, top: 59, bottom: 34 } as const;
const TALLEST = 775;
const PART = 0.62 * (TALLEST - 34) + 34;

describe("Add to Chat's bar at the sheet's visible foot", () => {
  it.each([
    ["content sized to the part detent, tallest not seen", PART, 0.62, undefined, 0],
    ["content sized to the part detent, tallest seen", PART, 0.62, TALLEST, 0],
    ["content mid-drag between the detents", 640, 0.62, TALLEST, 0],
    ["content at the tallest detent", TALLEST, 1, TALLEST, 0],
    ["content kept tall at the part detent, tallest seen", TALLEST, 0.62, TALLEST, TALLEST - PART],
    [
      "content kept tall at the part detent, tallest not seen",
      TALLEST,
      0.62,
      undefined,
      TALLEST - PART,
    ],
    ["content laid out past the window, tallest seen", 1400, 0.62, TALLEST, 1400 - PART],
    ["content laid out past the window at the tallest detent", 1400, 1, TALLEST, 1400 - TALLEST],
  ] as const)("%s", (_, height, fraction, tallest, lift) => {
    expect(footLift({ ...phone, height, fraction, tallest })).toBeCloseTo(lift);
  });
});
