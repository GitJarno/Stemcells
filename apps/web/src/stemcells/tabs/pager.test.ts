import { describe, expect, it } from "vite-plus/test";

import {
  band,
  COMMIT_DISTANCE,
  dragBy,
  dragPosition,
  KEEP_VISITED,
  mountedTabs,
  reach,
  releaseTarget,
  releaseVelocity,
  RUBBER_BAND,
  startDrag,
  unband,
  visit,
} from "./pager";

const WIDTH = 800;

describe("riding the fingers", () => {
  it("moves the strip one to one between the first and last page", () => {
    const drag = dragBy(startDrag(1, 1, 3, WIDTH), 200);
    expect(dragPosition(drag)).toBeCloseTo(1 + 200 / WIDTH);
  });

  it("gives a quarter of the move past the first page", () => {
    const drag = dragBy(startDrag(0, 0, 3, WIDTH), -400);
    expect(dragPosition(drag)).toBeCloseTo(-(400 * RUBBER_BAND) / WIDTH);
  });

  it("gives a quarter of the move past the last page", () => {
    const drag = dragBy(startDrag(2, 2, 3, WIDTH), 400);
    expect(dragPosition(drag)).toBeCloseTo(2 + (400 * RUBBER_BAND) / WIDTH);
  });

  it("stops at the next page in one swipe, so it never goes past the page it turns to", () => {
    expect(reach(2, 6)).toEqual({ lo: 1, hi: 3 });
    expect(dragPosition(dragBy(startDrag(2, 2, 6, WIDTH), 2 * WIDTH))).toBeCloseTo(3);
    expect(dragPosition(dragBy(startDrag(2, 2, 6, WIDTH), -2 * WIDTH))).toBeCloseTo(1);
    // Caught sliding on to 3, a push back goes no further than 2.
    expect(dragPosition(dragBy(startDrag(2.6, 3, 6, WIDTH), -WIDTH))).toBeCloseTo(2);
  });

  it("band and unband undo each other", () => {
    for (const shown of [-0.3, 0, 0.4, 1, 2.2]) {
      expect(band(unband(shown, 0, 2), 0, 2)).toBeCloseTo(shown);
    }
  });
});

describe("letting go", () => {
  const from = (travel: number) => releaseTarget(dragBy(startDrag(1, 1, 3, WIDTH), travel));

  it("springs back short of the commit distance, either way", () => {
    expect(from(COMMIT_DISTANCE - 1)).toBe(1);
    expect(from(-(COMMIT_DISTANCE - 1))).toBe(1);
  });

  it("turns to the next page past it, either way", () => {
    expect(from(COMMIT_DISTANCE + 1)).toBe(2);
    expect(from(-(COMMIT_DISTANCE + 1))).toBe(0);
  });

  it("judges by distance alone: out and back is no turn", () => {
    const drag = dragBy(dragBy(startDrag(1, 1, 3, WIDTH), 300), -250);
    expect(releaseTarget(drag)).toBe(1);
  });

  it("springs back past the ends, however far", () => {
    expect(releaseTarget(dragBy(startDrag(0, 0, 3, WIDTH), -600))).toBe(0);
    expect(releaseTarget(dragBy(startDrag(2, 2, 3, WIDTH), 600))).toBe(2);
  });

  it("leaves out what the coast added before it was recognised", () => {
    const drag = dragBy(startDrag(1, 1, 3, WIDTH), 130);
    expect(releaseTarget(drag)).toBe(2);
    expect(releaseTarget(drag, 130 - 40)).toBe(1);
  });

  it("sets off at the strip's speed, as a share of the move, toward the target", () => {
    expect(releaseVelocity(1.5, 2, 1, 100)).toBeCloseTo(2);
    expect(releaseVelocity(1.2, 1, -0.5, 100)).toBeCloseTo(2.5);
  });

  it("sets off from rest when the strip was moving away from the target, so it never sails past where the fingers left it", () => {
    expect(releaseVelocity(1.2, 1, 0.5, 100)).toBe(0);
    expect(releaseVelocity(0.8, 1, -3, 100)).toBe(0);
  });

  it("caps that speed below the spring's own, so it never overshoots", () => {
    expect(releaseVelocity(1.99, 2, 10, 12)).toBeCloseTo(12 * 0.9);
    expect(releaseVelocity(2, 2, 10, 12)).toBe(0);
  });
});

describe("a hand catching the strip as it settles", () => {
  // A swipe from page 1 to 2 is settling, halfway there.
  const halfway = 1.5;

  it("takes it where it is on screen, without a jump", () => {
    expect(dragPosition(startDrag(halfway, 2, 3, WIDTH))).toBeCloseTo(halfway);
  });

  it("lets go to where it was going after a short move", () => {
    expect(releaseTarget(dragBy(startDrag(halfway, 2, 3, WIDTH), -60))).toBe(2);
  });

  it("pushing on goes one page past the one it was going to: a second quick swipe is a second turn", () => {
    expect(reach(2, 4)).toEqual({ lo: 1, hi: 3 });
    expect(releaseTarget(dragBy(startDrag(halfway, 2, 4, WIDTH), 200))).toBe(3);
    // Short of the commit distance, it goes on to the page it was going to.
    expect(releaseTarget(dragBy(startDrag(halfway, 2, 4, WIDTH), 60))).toBe(2);
  });

  it("caught going home, a push either way reaches the pages beside home", () => {
    // A short swipe from 2 springs back from 2.3: the next swipe starts there.
    expect(releaseTarget(dragBy(startDrag(2.3, 2, 5, WIDTH), -200))).toBe(1);
    expect(releaseTarget(dragBy(startDrag(2.3, 2, 5, WIDTH), 200))).toBe(3);
  });

  it("pushing back takes it back", () => {
    expect(releaseTarget(dragBy(startDrag(halfway, 2, 3, WIDTH), -200))).toBe(1);
  });

  it("a page behind where it goes (the page was busy), one back is one tab back, and the strip follows from where it is", () => {
    // Two quick swipes on from 2 headed to 4; the strip has only got to 2.7.
    const drag = startDrag(2.7, 4, 5, WIDTH);
    expect(dragPosition(drag)).toBeCloseTo(2.7);
    expect(dragPosition(dragBy(drag, 120))).toBeCloseTo(2.7 + 120 / WIDTH);
    expect(releaseTarget(dragBy(drag, -200))).toBe(3);
  });

  it("caught in the rubber band, it stays where it is", () => {
    const shown = -0.05;
    const drag = startDrag(shown, 0, 3, WIDTH);
    expect(dragPosition(drag)).toBeCloseTo(shown);
    expect(releaseTarget(dragBy(drag, COMMIT_DISTANCE + 50))).toBe(1);
  });
});

describe("which pages stay mounted", () => {
  const tabs = ["a", "b", "c", "d", "e", "f", "g"];

  it("the active page and those either side", () => {
    expect(mountedTabs(tabs, "d", "d", ["d"])).toEqual(["c", "d", "e"]);
    expect(mountedTabs(tabs, "a", "a", ["a"])).toEqual(["a", "b"]);
  });

  it("and the last few visited, so a swipe back finds them as they were", () => {
    expect(mountedTabs(tabs, "g", "g", ["g", "a", "d"])).toEqual(["a", "d", "f", "g"]);
  });

  it("the active page at once; its new neighbours once the turn has settled in", () => {
    expect(mountedTabs(tabs, "e", "d", ["e", "d"])).toEqual(["c", "d", "e"]);
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
