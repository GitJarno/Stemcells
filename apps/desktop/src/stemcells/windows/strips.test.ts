import { describe, expect, it } from "vite-plus/test";

import { placeStrip, readMeasured } from "./strips.ts";

const measured = {
  zoom: 1.25,
  rect: { left: 72, top: 0, width: 800, height: 36 },
  chips: [{ tabId: "a", rect: { left: 100, top: 6, width: 160, height: 24 } }],
  gap: 4,
  start: 100,
};

describe("another window's strip", () => {
  it("lands on the screen in points, from the window's content and its page's zoom", () => {
    const content = { x: -1200, y: 40, width: 1000, height: 700 };
    expect(placeStrip("w", content, readMeasured(measured)!)).toEqual({
      id: "w",
      frame: content,
      strip: {
        rect: { x: -1110, y: 40, width: 1000, height: 45 },
        chips: [{ tabId: "a", rect: { x: -1075, y: 47.5, width: 200, height: 30 } }],
        gap: 5,
        start: -1075,
      },
    });
  });

  it("takes nothing from a page that answered something else", () => {
    expect(readMeasured(null)).toBeNull();
    expect(readMeasured({ ...measured, zoom: 0 })).toBeNull();
    expect(readMeasured({ ...measured, chips: [{ tabId: 1, rect: measured.rect }] })).toBeNull();
  });
});
