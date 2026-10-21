import { describe, expect, it } from "vite-plus/test";

import {
  MARGIN,
  REST,
  clampPose,
  corner,
  detailZoom,
  drawnRect,
  fadedPose,
  // Called bare, `fit` reads as Jasmine's focused `it` to the test lint.
  fit as fitIn,
  mostZoom,
  onThumbnail,
  pinchRelease,
  room,
  rubber,
  swipeStep,
  visibleShare,
  zoomAbout,
  type Rect,
} from "./geometry";

const window = { width: 1440, height: 900 };

describe("where a picture rests", () => {
  it("leaves the margins clear, under the title bar", () => {
    expect(room(window, 28)).toEqual({
      x: MARGIN.side,
      y: MARGIN.top + 28,
      width: 1440 - 2 * MARGIN.side,
      height: 900 - MARGIN.top - 28 - MARGIN.foot,
    });
  });

  it("fits a large screenshot with its shape kept, centred in the room", () => {
    const space = room(window, 0);
    const rest = fitIn({ width: 2880, height: 1800 }, space);
    expect(rest.height).toBeCloseTo(space.height);
    expect(rest.width / rest.height).toBeCloseTo(2880 / 1800);
    expect(rest.x + rest.width / 2).toBeCloseTo(space.x + space.width / 2);
  });

  it("never blows a small picture up past its own pixels", () => {
    const rest = fitIn({ width: 320, height: 200 }, room(window, 0));
    expect(rest.width).toBe(320);
    expect(rest.height).toBe(200);
  });

  it("rounds with the card's corner, smaller on a small picture", () => {
    expect(corner({ width: 800, height: 600 }, 12)).toBe(12);
    expect(corner({ width: 64, height: 40 }, 12)).toBe(5);
  });
});

describe("a thumbnail's drawn picture", () => {
  const tile: Rect = { x: 100, y: 100, width: 200, height: 150 };

  it("spills past a cover tile on its long side", () => {
    const drawn = drawnRect(tile, { width: 1600, height: 900 }, "cover");
    expect(drawn.height).toBe(150);
    expect(drawn.width).toBeCloseTo((1600 / 900) * 150);
    expect(drawn.x + drawn.width / 2).toBeCloseTo(200);
  });

  it("letterboxes inside a contain box (a video's default)", () => {
    const drawn = drawnRect(tile, { width: 1600, height: 900 }, "contain");
    expect(drawn.width).toBe(200);
    expect(drawn.height).toBeCloseTo(112.5);
    expect(drawn.y).toBeCloseTo(118.75);
  });
});

describe("the flight's start", () => {
  it("lays the resting picture exactly over a cropped thumbnail", () => {
    const rest: Rect = { x: 200, y: 100, width: 1600, height: 900 };
    const tile: Rect = { x: 40, y: 500, width: 200, height: 150 };
    const drawn = drawnRect(tile, { width: 1600, height: 900 }, "cover");
    const { pose, clip } = onThumbnail(rest, drawn, tile, 8);
    // The picture's corners land on the drawn picture's…
    expect(rest.x + pose.x).toBeCloseTo(drawn.x);
    expect(rest.y + pose.y).toBeCloseTo(drawn.y);
    expect(rest.width * pose.scale).toBeCloseTo(drawn.width);
    // …and its crop, scaled, is the tile.
    expect(rest.x + pose.x + clip.left * pose.scale).toBeCloseTo(tile.x);
    expect(rest.x + pose.x + (rest.width - clip.right) * pose.scale).toBeCloseTo(
      tile.x + tile.width,
    );
    expect(clip.top).toBeCloseTo(0);
    expect(clip.radius * pose.scale).toBeCloseTo(8);
  });

  it("fades out shrinking about its centre", () => {
    const rest: Rect = { x: 0, y: 0, width: 1000, height: 500 };
    const pose = fadedPose(rest);
    expect(pose.x + (rest.width * pose.scale) / 2).toBeCloseTo(500);
    expect(pose.y + (rest.height * pose.scale) / 2).toBeCloseTo(250);
  });
});

describe("a thumbnail in view", () => {
  it("counts the share inside every clip", () => {
    const thumb: Rect = { x: 0, y: 80, width: 100, height: 100 };
    const scroller: Rect = { x: 0, y: 100, width: 800, height: 600 };
    expect(visibleShare(thumb, [scroller])).toBeCloseTo(0.8);
    expect(visibleShare(thumb, [{ x: 0, y: 400, width: 800, height: 100 }])).toBe(0);
  });
});

describe("zoom", () => {
  const rest: Rect = { x: 100, y: 50, width: 800, height: 500 };

  it("keeps the spot under the pointer still", () => {
    const point = { x: 300, y: 200 };
    const zoomed = zoomAbout(REST, rest, point, 3);
    // The picture's spot under the pointer, before and after.
    const before = { x: (point.x - rest.x) / 1, y: (point.y - rest.y) / 1 };
    expect(rest.x + zoomed.x + before.x * zoomed.scale).toBeCloseTo(point.x);
    expect(rest.y + zoomed.y + before.y * zoomed.scale).toBeCloseTo(point.y);
  });

  it("keeps a zoomed picture on screen, and a smaller axis centred where it rests", () => {
    const far = clampPose({ x: 5000, y: 0, scale: 2 }, rest, { width: 1000, height: 1200 });
    expect(rest.x + far.x).toBe(0);
    // 1000 tall at 2×, in a 1200 tall window: centred on its rest.
    expect(rest.y + far.y + (rest.height * 2) / 2).toBeCloseTo(rest.y + rest.height / 2);
  });

  it("goes to the picture's own pixels on a double-click when they are more than twice the fit", () => {
    expect(detailZoom({ width: 4000, height: 2500 }, rest)).toBe(5);
    expect(detailZoom({ width: 1000, height: 625 }, rest)).toBe(2);
    expect(mostZoom({ width: 4000, height: 2500 }, rest)).toBe(10);
  });

  it("closes on a pinch let go well below rest", () => {
    expect(pinchRelease(0.7, 4)).toBe("close");
    expect(pinchRelease(1.01, 4)).toBe("rest");
    expect(pinchRelease(5, 4)).toBe("most");
    expect(pinchRelease(2, 4)).toBe("hold");
  });

  it("gives less the further a drag goes past an edge", () => {
    expect(rubber(100, 1000)).toBeLessThan(100);
    expect(rubber(400, 1000) - rubber(300, 1000)).toBeLessThan(rubber(100, 1000));
    expect(rubber(-100, 1000)).toBeCloseTo(-rubber(100, 1000));
  });
});

describe("a swipe let go", () => {
  it("turns past its travel, either way", () => {
    expect(swipeStep(-80, 0)).toBe(1);
    expect(swipeStep(80, 0)).toBe(-1);
    expect(swipeStep(-40, 0)).toBe(0);
  });

  it("turns on a flick that is short but fast the same way", () => {
    expect(swipeStep(-20, -900)).toBe(1);
    expect(swipeStep(-20, 900)).toBe(0);
    expect(swipeStep(-5, -900)).toBe(0);
  });
});
