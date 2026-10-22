import { describe, expect, it } from "vite-plus/test";

import { chipElsewhereAt, halfOf, paneLandingAt, sideAt, stripLandingAt } from "./paneLanding";

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

describe("carrying a chat over the strip", () => {
  const strip = { x: 0, y: 0, width: 1000, height: 36 };
  const chips = [
    { tabId: "a", rect: { x: 60, y: 6, width: 160, height: 24 } },
    { tabId: "b", rect: { x: 224, y: 6, width: 160, height: 24 } },
  ];

  it("rests on the chip under the hand, the whole strip's height", () => {
    expect(stripLandingAt(strip, chips, { x: 300, y: 2 })).toEqual({ kind: "chip", tabId: "b" });
  });

  it("offers a new tab past the last chip, and nothing between chips or off the strip", () => {
    expect(stripLandingAt(strip, chips, { x: 600, y: 18 })).toEqual({ kind: "end" });
    expect(stripLandingAt(strip, chips, { x: 222, y: 18 })).toBeNull();
    expect(stripLandingAt(strip, chips, { x: 20, y: 18 })).toBeNull();
    expect(stripLandingAt(strip, chips, { x: 600, y: 40 })).toBeNull();
  });
});

describe("carrying a chat over another window's strip", () => {
  const place = (id: string, x: number) => ({
    id,
    frame: { x, y: 100, width: 800, height: 600 },
    strip: {
      rect: { x: x + 70, y: 100, width: 730, height: 36 },
      chips: [
        { tabId: `${id}1`, rect: { x: x + 100, y: 106, width: 160, height: 24 }, rowWidth: 700 },
      ],
      gap: 4,
      start: x + 100,
    },
  });
  // Front to back: "front" covers "back"'s chip but for its last 60 px.
  const places = [place("front", 0), place("back", 600)];

  it("goes into the chip under the hand, in the window in front there", () => {
    expect(chipElsewhereAt(places, { x: 150, y: 102 })).toEqual({
      window: "front",
      tabId: "front1",
      chip: { x: 100, y: 106, width: 160, height: 24 },
      rowWidth: 700,
    });
    expect(chipElsewhereAt(places, { x: 830, y: 118 })?.tabId).toBe("back1");
    expect(chipElsewhereAt(places, { x: 750, y: 118 })).toBeNull();
  });

  it("takes nothing off a chip, off a strip, or outside every window", () => {
    expect(chipElsewhereAt(places, { x: 400, y: 118 })).toBeNull();
    expect(chipElsewhereAt(places, { x: 150, y: 300 })).toBeNull();
    expect(chipElsewhereAt(places, { x: 2000, y: 118 })).toBeNull();
  });
});
