/**
 * A wheel over the floating composer scrolled nothing: the transcript under
 * it stood still. It now goes through, except where the field has more to
 * show that way, and a sideways swipe stays the tab pager's.
 */
import { describe, expect, it } from "vite-plus/test";

import { goesThrough, hasRoom, wheelPixels } from "./scrollThrough";

describe("a wheel over the composer", () => {
  it("goes through when it is mostly vertical", () => {
    expect(goesThrough({ deltaX: 0, deltaY: 40, ctrlKey: false })).toBe(true);
    expect(goesThrough({ deltaX: 3, deltaY: -40, ctrlKey: false })).toBe(true);
  });

  it("leaves a sideways swipe to the pager, and a pinch to the zoom", () => {
    expect(goesThrough({ deltaX: 40, deltaY: 10, ctrlKey: false })).toBe(false);
    expect(goesThrough({ deltaX: 20, deltaY: 20, ctrlKey: false })).toBe(false);
    expect(goesThrough({ deltaX: 0, deltaY: 40, ctrlKey: true })).toBe(false);
  });

  it("stays the field's while the field can move that way, and not at its ends", () => {
    const field = { scrollHeight: 300, clientHeight: 100 };
    expect(hasRoom({ ...field, scrollTop: 0 }, 40)).toBe(true);
    expect(hasRoom({ ...field, scrollTop: 0 }, -40)).toBe(false);
    expect(hasRoom({ ...field, scrollTop: 200 }, 40)).toBe(false);
    expect(hasRoom({ ...field, scrollTop: 200 }, -40)).toBe(true);
    expect(hasRoom({ scrollHeight: 100, clientHeight: 100, scrollTop: 0 }, 40)).toBe(false);
  });

  it("travels a mouse's lines and pages in pixels", () => {
    expect(wheelPixels(3, 0, 800)).toBe(3);
    expect(wheelPixels(3, 1, 800)).toBe(48);
    expect(wheelPixels(-1, 2, 800)).toBe(-800);
  });
});
