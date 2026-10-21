import { describe, expect, it } from "vite-plus/test";

import { letterStagger, orbitAt, standing, streamStarts, trace } from "./plan";

describe("the spawn's letters", () => {
  // Aski is drawn as tall as the box it is given: the headline alone left
  // it a few lines high, and the letters crowded into a knot.
  it("go round Aski standing on the headline, Aski's own height", () => {
    const aski = standing({ x: 100, y: 600, width: 700, height: 40 }, 110);
    expect(aski).toEqual({ x: 100, y: 490, width: 700, height: 110 });
    const top = orbitAt(aski, 0, 26, 0);
    const bottom = orbitAt(aski, 13, 26, 0);
    expect(bottom.y - top.y).toBeCloseTo(110);
  });

  it("leave the stagger apart, or closer so all of them leave within the span", () => {
    expect(letterStagger(10, 22, 460)).toBe(22);
    expect(letterStagger(40, 22, 460)).toBe(11.5);
    expect(letterStagger(0, 22, 460)).toBe(0);
  });

  it("ride an orbit round Aski, evenly spaced, clockwise from the top", () => {
    const box = { x: 0, y: 0, width: 400, height: 100 };
    const near = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });
    expect(near(orbitAt(box, 0, 4, 0))).toEqual({ x: 200, y: 0 });
    expect(near(orbitAt(box, 1, 4, 0))).toEqual({ x: 300, y: 50 });
    // A quarter turn on, the first letter is where the second was.
    expect(near(orbitAt(box, 0, 4, 0.25))).toEqual(near(orbitAt(box, 1, 4, 0)));
  });

  it("bow to the left of their way, and end where they're going", () => {
    const way = trace({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.2, 4);
    expect(way[0]).toEqual({ x: 0, y: 0 });
    expect(way[4]).toEqual({ x: 100, y: 0 });
    // Travelling right on screen, left is up: y goes negative.
    expect(way[2]!.y).toBeLessThan(0);
    expect(trace({ x: 0, y: 0 }, { x: 100, y: 0 }, 0, 2)[1]).toEqual({ x: 50, y: 0 });
  });
});

describe("the spawn's streams", () => {
  const origin = { x: 0, y: 0 };
  const timing = { stagger: 90, travel: 480 };

  it("leave nearest first, the stagger apart", () => {
    const starts = streamStarts(
      origin,
      [
        { x: 300, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ],
      timing,
    );
    expect(starts).toEqual([180, 0, 90]);
  });

  it("never have more than four in flight", () => {
    const targets = Array.from({ length: 7 }, (_, i) => ({ x: (i + 1) * 100, y: 0 }));
    const starts = streamStarts(origin, targets, timing);
    expect(starts).toEqual([0, 90, 180, 270, 480, 570, 660]);
    for (const start of starts) {
      const flying = starts.filter((s) => s <= start && start < s + timing.travel);
      expect(flying.length).toBeLessThanOrEqual(4);
    }
  });
});
