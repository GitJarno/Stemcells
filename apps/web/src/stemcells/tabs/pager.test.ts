import { describe, expect, it } from "vite-plus/test";

import { keep, KEEP_VISITED, MOUNTED_MOST, releaseVelocity, settle, visit } from "./pager";

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
  const tabs = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"];
  const sorted = (ids: readonly string[]) => ids.toSorted();

  it("keeps the active page and two either side", () => {
    expect(sorted(keep([], tabs, "d", ["d"]))).toEqual(["b", "c", "d", "e", "f"]);
    expect(sorted(keep([], tabs, "a", ["a"]))).toEqual(["a", "b", "c"]);
  });

  it("and the last few visited, so a swipe back finds them as they were", () => {
    expect(sorted(keep([], tabs, "n", ["n", "a", "g"]))).toEqual(["a", "g", "l", "m", "n"]);
  });

  // Each turn between two tabs used to mount the page two past the one arrived at and unmount
  // the one two past the other: seconds of work for a turn that showed nothing new.
  it("mounts and unmounts nothing going back and forth between tabs", () => {
    let kept = keep([], tabs, "e", ["e"]);
    kept = keep(kept, tabs, "f", ["f", "e"]);
    const there = sorted(kept);
    for (const [active, visited] of [
      ["e", ["e", "f"]],
      ["f", ["f", "e"]],
      ["e", ["e", "f"]],
    ] as const) {
      kept = keep(kept, tabs, active, visited);
      expect(sorted(kept)).toEqual(there);
    }
  });

  it("drops the pages wanted least once there are too many", () => {
    let kept: string[] = [];
    let visited: string[] = [];
    for (const active of ["a", "f", "k", "n"]) {
      visited = visit(visited, active, tabs);
      kept = keep(kept, tabs, active, visited);
    }
    expect(kept).toHaveLength(MOUNTED_MOST);
    // The page on stage, the pages beside it and every page visited are among them.
    expect(kept).toEqual(expect.arrayContaining(["n", "m", "l", "k", "f", "a"]));
  });

  it("forgets a tab that is gone", () => {
    expect(keep(["a", "b", "c"], ["a", "c"], "a", ["a", "b"])).toEqual(["a", "c"]);
  });

  it("lets the kept pages in one at a time, the most wanted first", () => {
    const kept = keep(["d"], tabs, "d", ["d"]);
    expect(settle(["d"], kept)).toEqual(["d", "c"]);
    expect(settle(["d", "c"], kept)).toEqual(["d", "c", "e"]);
    expect(settle(kept, kept)).toEqual(kept);
  });

  it("takes out the pages no longer kept before it lets another in", () => {
    expect(settle(["a", "x", "d"], ["d", "c", "a"])).toEqual(["a", "d"]);
  });

  it("the visited list keeps the most recent few, of tabs that still exist", () => {
    let visited: string[] = [];
    for (const id of ["a", "b", "c", "d", "e", "b"]) visited = visit(visited, id, tabs);
    expect(visited).toEqual(["b", "e", "d", "c"].slice(0, KEEP_VISITED));
    expect(visit(visited, "c", ["b", "c"])).toEqual(["c", "b"]);
  });
});
