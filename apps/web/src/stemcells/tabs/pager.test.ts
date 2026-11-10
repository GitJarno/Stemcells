import { describe, expect, it } from "vite-plus/test";

import { KEEP_VISITED, mountedTabs, releaseVelocity, visit } from "./pager";

describe("a slide's first speed", () => {
  it("sets off at the strip's speed, as a share of the move, toward the target", () => {
    expect(releaseVelocity(1.5, 2, 1, 100)).toBeCloseTo(2);
    expect(releaseVelocity(1.2, 1, -0.5, 100)).toBeCloseTo(2.5);
  });

  it("sets off from rest when the strip was moving away from the target, so it never sails past where it was", () => {
    expect(releaseVelocity(1.2, 1, 0.5, 100)).toBe(0);
    expect(releaseVelocity(0.8, 1, -3, 100)).toBe(0);
  });

  it("caps that speed below the spring's own, so it never overshoots", () => {
    expect(releaseVelocity(1.99, 2, 10, 12)).toBeCloseTo(12 * 0.9);
    expect(releaseVelocity(2, 2, 10, 12)).toBe(0);
  });
});

describe("which pages stay mounted", () => {
  const tabs = ["a", "b", "c", "d", "e", "f", "g"];

  it("the active page and two either side", () => {
    expect(mountedTabs(tabs, "d", "d", ["d"])).toEqual(["b", "c", "d", "e", "f"]);
    expect(mountedTabs(tabs, "a", "a", ["a"])).toEqual(["a", "b", "c"]);
  });

  it("and the last few visited, so a swipe back finds them as they were", () => {
    expect(mountedTabs(tabs, "g", "g", ["g", "a", "d"])).toEqual(["a", "d", "e", "f", "g"]);
  });

  it("the active page at once; its new neighbours once the turn has settled in", () => {
    expect(mountedTabs(tabs, "e", "d", ["e", "d"])).toEqual(["b", "c", "d", "e", "f"]);
  });

  // The pages that become a turn's neighbours mount after it, in a render a
  // busy stream can hold back; a second swipe can set off before then.
  it("every page a second swipe can reach before the first has settled in", () => {
    const beside = (at: number) =>
      [at - 1, at + 1].filter((page) => page >= 0 && page < tabs.length);
    tabs.forEach((settled, at) => {
      for (const heading of beside(at)) {
        expect(mountedTabs(tabs, tabs[heading]!, settled, [settled])).toEqual(
          expect.arrayContaining(beside(heading).map((page) => tabs[page])),
        );
      }
    });
  });

  it("the visited list keeps the most recent few, of tabs that still exist", () => {
    let visited: string[] = [];
    for (const id of ["a", "b", "c", "d", "e", "b"]) visited = visit(visited, id, tabs);
    expect(visited).toEqual(["b", "e", "d", "c"].slice(0, KEEP_VISITED));
    expect(visit(visited, "c", ["b", "c"])).toEqual(["c", "b"]);
  });

  it("orders pages by id, so one joining never moves another in the document", () => {
    expect(mountedTabs(["z", "m", "a"], "m", "m", ["m"])).toEqual(["a", "m", "z"]);
  });
});
