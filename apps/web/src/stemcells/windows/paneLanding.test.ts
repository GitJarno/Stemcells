import { describe, expect, it } from "vite-plus/test";

import { halfOf, paneLandingAt, sideAt } from "./paneLanding";

const pane = { x: 100, y: 0, width: 400, height: 200 };

describe("carrying a chat onto a pane", () => {
  it("takes the side the hand is nearest, across the pane's own proportions", () => {
    expect(sideAt(pane, { x: 120, y: 100 })).toBe("left");
    expect(sideAt(pane, { x: 480, y: 100 })).toBe("right");
    // 50 px down a 200 px pane is nearer its top than 150 px in is to its left.
    expect(sideAt(pane, { x: 250, y: 40 })).toBe("above");
    expect(sideAt(pane, { x: 250, y: 190 })).toBe("below");
  });

  it("lights the half on that side", () => {
    expect(halfOf(pane, "right")).toEqual({ x: 300, y: 0, width: 200, height: 200 });
    expect(halfOf(pane, "below")).toEqual({ x: 100, y: 100, width: 400, height: 100 });
  });

  it("goes back over its own place or over no pane", () => {
    const panes = [
      { paneId: "a", rect: { x: 0, y: 0, width: 100, height: 200 } },
      { paneId: "b", rect: pane },
    ];
    expect(paneLandingAt(panes, "a", { x: 50, y: 100 })).toBeNull();
    expect(paneLandingAt(panes, "a", { x: 600, y: 100 })).toBeNull();
    expect(paneLandingAt(panes, "a", { x: 120, y: 100 })).toEqual({
      anchor: "b",
      side: "left",
      half: { x: 100, y: 0, width: 200, height: 200 },
    });
  });
});
