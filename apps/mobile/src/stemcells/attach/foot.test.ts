import { describe, expect, it } from "vite-plus/test";

import { footLift } from "./foot";

describe("Add to Chat's bar at the sheet's visible foot", () => {
  it.each([
    // An 844-point phone: the part detent shows the card from y 351, laid out 775 tall.
    ["content laid out past the window at the part detent", 351, 775, 844, 282],
    ["content ending at the window's bottom edge", 69, 775, 844, 0],
    // The unfolded Duo held sideways, a 669-point window: the bar stood mid-card here.
    ["the Duo's wide window, content laid out past it", 40, 900, 669, 271],
    ["a centred sheet that ends above the window's edge", 120, 400, 669, 0],
  ] as const)("%s", (_, top, height, window, lift) => {
    expect(footLift({ top, height, window })).toBe(lift);
  });
});
