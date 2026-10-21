/**
 * The zoom level shows when the page's zoom changes, whatever changed it,
 * and only then: ⌘+ ⌘− ⌘0 in the desktop app (half a level a step), a
 * browser's zoom, but not a window resize or a move to another display.
 */
import { describe, expect, it } from "vite-plus/test";

import { followZoom, zoomOf, type ZoomView } from "./zoomLevel";

/** The desktop app at a Chromium zoom level, which ⌘+ and ⌘− move by half. */
const app = (level: number, innerWidth = 1600): ZoomView => ({
  appZoomFactor: 1.2 ** level,
  outerWidth: 1600,
  innerWidth,
  devicePixelRatio: 2 * 1.2 ** level,
});

/** A browser window 1600 points wide on a display of `scale`, at `zoom`. */
const browser = (zoom: number, scale = 2, outerWidth = 1600): ZoomView => ({
  appZoomFactor: undefined,
  outerWidth,
  innerWidth: Math.round(outerWidth / zoom),
  devicePixelRatio: scale * zoom,
});

describe("the zoom level", () => {
  it("is the desktop app's own zoom, in percent", () => {
    expect([0, 0.5, 1, 1.5, -0.5, -1].map((level) => zoomOf(app(level)))).toEqual([
      100, 110, 120, 131, 91, 83,
    ]);
  });

  it("is a browser's zoom, read off its window", () => {
    expect([1, 1.1, 1.25, 0.9, 0.67].map((zoom) => zoomOf(browser(zoom)))).toEqual([
      100, 110, 125, 90, 67,
    ]);
    expect(zoomOf(browser(1.1, 1))).toBe(110);
  });

  it("is unreadable in a browser with something beside the page", () => {
    // An inspector docked beside the page: the window is wider than the page it shows.
    expect(zoomOf({ ...browser(1), innerWidth: 1180 })).toBeNull();
  });
});

describe("following the zoom", () => {
  it("shows each step of ⌘+ and ⌘−, and ⌘0 back at 100%", () => {
    const follow = followZoom(app(0));
    expect([0.5, 1, 1.5, 1, 0].map((level) => follow(app(level)))).toEqual([
      110, 120, 131, 120, 100,
    ]);
  });

  it("shows nothing when the window resizes at the same zoom", () => {
    const follow = followZoom(app(0.5));
    expect(follow(app(0.5, 1200))).toBeNull();
    const browsing = followZoom(browser(1));
    expect(browsing(browser(1, 2, 1200))).toBeNull();
  });

  it("shows a browser's zoom, but not a move to another display", () => {
    const follow = followZoom(browser(1));
    expect(follow(browser(1.1))).toBe(110);
    expect(follow(browser(1.1, 1))).toBeNull();
    expect(follow(browser(1, 1))).toBe(100);
  });
});
