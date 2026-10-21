import { describe, expect, it } from "vite-plus/test";

import type { Rect } from "./arrangement";
import {
  bandShown,
  cancel,
  landingMotion,
  morphOf,
  moveHand,
  pickUp,
  previewSize,
  release,
  slotAt,
  tick,
  type Carry,
  type CarryGeometry,
  type PickUp,
  type WindowPlace,
} from "./carry";
import { LAPTOP, MONITOR } from "./fixtures";

/** A window with its strip along its top: Aski's place, then 120 px chips 4 px apart. */
function place(id: string, frame: Rect, tabIds: string[]): WindowPlace {
  const start = frame.x + 80;
  return {
    id,
    frame,
    strip: {
      rect: { x: frame.x, y: frame.y, width: frame.width, height: 36 },
      gap: 4,
      start,
      chips: tabIds.map((tabId, index) => ({
        tabId,
        rect: { x: start + index * 124, y: frame.y + 6, width: 120, height: 24 },
      })),
    },
  };
}

// Front to back: a in front; b to its right; c behind a, its strip hidden under a.
const A = place("a", { x: 100, y: 100, width: 900, height: 700 }, ["t1", "t2", "t3"]);
const B = place("b", { x: 1100, y: 150, width: 800, height: 600 }, ["b1", "b2"]);
const C = place("c", { x: 150, y: 300, width: 700, height: 400 }, ["c1"]);
const geometry: CarryGeometry = { windows: [A, B, C], displays: [LAPTOP, MONITOR] };

// t2's chip is 304..424 by 106..130: the press grabs it 60 px in, 12 px down.
const START: PickUp = {
  window: "a",
  tabId: "t2",
  press: { x: 364, y: 118 },
  at: 0,
  onlyTab: false,
  tears: true,
  preview: { width: 900, height: 700 },
  springLoad: 350,
};

/** A recorded hand: each sample 8 ms after the last. */
function play(
  carry: Carry,
  hand: ReadonlyArray<readonly [number, number]>,
  from = carry.at,
): Carry {
  return hand.reduce((at, [x, y], index) => moveHand(at, { x, y }, from + 8 * (index + 1)), carry);
}

const carried = (start: Partial<PickUp> = {}, on: CarryGeometry = geometry) =>
  pickUp(on, { ...START, ...start })!;

/** Torn straight down out of a's strip, 24 px past its bottom (136). */
const torn = () =>
  play(carried(), [
    [364, 130],
    [364, 150],
    [364, 160],
  ]);

describe("the band", () => {
  it("shows the pull at once, less with each pixel, 7.6 px at the tear", () => {
    expect(bandShown(0)).toBe(0);
    expect(bandShown(4)).toBeGreaterThan(1.5);
    expect(bandShown(24)).toBeCloseTo(7.6, 1);
    expect(bandShown(1000)).toBeLessThan(18);
    expect(bandShown(13) - bandShown(12)).toBeLessThan(bandShown(2) - bandShown(1));
  });
});

describe("a chip along its own strip", () => {
  it("is a click until the hand moves 4 px", () => {
    const pressed = play(carried(), [[366, 119]]);
    expect(pressed.carried.kind).toBe("pressed");
    expect(release(pressed)).toEqual({ kind: "click" });
  });

  it("reorders as the strip does today", () => {
    const along = play(carried(), [
      [380, 118],
      [430, 118],
      [494, 118],
    ]);
    expect(along.carried).toMatchObject({ kind: "banding", slot: 2, pulled: 0 });
    expect(release(along)).toEqual({ kind: "reorder", slot: 2, chip: null });
  });

  it("bands past the strip's bottom or top, and tears 24 px past it", () => {
    const down = play(carried(), [
      [364, 140],
      [364, 148],
    ]);
    expect(down.carried).toMatchObject({ kind: "banding", pulled: bandShown(12) });
    expect(play(down, [[364, 159]]).carried.kind).toBe("banding");
    expect(play(down, [[364, 160]]).carried.kind).toBe("open");

    const up = play(carried(), [
      [364, 96],
      [364, 88],
    ]);
    expect(up.carried).toMatchObject({ kind: "banding", pulled: -bandShown(12) });
    expect(play(up, [[364, 76]]).carried.kind).toBe("open");
  });
});

describe("in a browser, which has one window", () => {
  it("bands past the strip and never tears", () => {
    const held = play(carried({ tears: false }), [
      [364, 160],
      [364, 400],
    ]);
    expect(held.carried).toMatchObject({ kind: "banding", pulled: bandShown(264) });
    expect(release(held)).toEqual({ kind: "reorder", slot: 1, chip: null });
  });
});

describe("a tab torn off", () => {
  it("hangs a window preview from the hand, its chip under the point it was grabbed", () => {
    for (const carry of [
      torn(),
      play(torn(), [
        [700, 420],
        [1200, 900],
      ]),
    ]) {
      expect(carry.carried.kind).toBe("open");
      if (carry.carried.kind !== "open") continue;
      const { frame } = carry.carried;
      expect(frame).toMatchObject({ width: 900, height: 700 });
      // The preview's chip sits where a window's first chip does: 80 px in, 6 px down.
      expect(carry.hand.x - (frame.x + 80)).toBe(60);
      expect(carry.hand.y - (frame.y + 6)).toBe(12);
    }
  });

  it("keeps the preview's top below the menu bar", () => {
    const high = play(torn(), [[700, 20]]);
    expect(high.carried).toMatchObject({ kind: "open", frame: { y: LAPTOP.workArea.y } });
  });

  it("let go in open space, opens a window on the preview's frame, on the display under it", () => {
    const here = play(torn(), [[700, 420]]);
    expect(here.carried.kind === "open" && release(here)).toEqual({
      kind: "window",
      frame: here.carried.kind === "open" ? here.carried.frame : null,
      display: "laptop",
    });
    const there = play(torn(), [[2600, 600]]);
    expect(release(there)).toMatchObject({ kind: "window", display: "monitor" });
  });

  it("docks in another window's strip at the slot under the hand, 8 px past a middle", () => {
    // b's chips' middles are at 1240 and 1364.
    const over = play(torn(), [
      [900, 300],
      [1250, 165],
    ]);
    expect(over.carried).toMatchObject({ kind: "docked", window: "b", slot: 1 });
    expect(over.carried.kind === "docked" && over.carried.chip).toEqual({
      x: 1190,
      y: 156,
      width: 120,
      height: 24,
    });
    expect(play(over, [[1371, 165]]).carried).toMatchObject({ slot: 1 });
    const along = play(over, [[1373, 165]]);
    expect(along.carried).toMatchObject({ slot: 2 });
    expect(play(along, [[1357, 165]]).carried).toMatchObject({ slot: 2 });
    expect(play(along, [[1355, 165]]).carried).toMatchObject({ slot: 1 });
    // It lands after b's last chip.
    expect(release(along)).toEqual({
      kind: "strip",
      window: "b",
      slot: 2,
      chip: { x: 1428, y: 156, width: 120, height: 24 },
    });
  });

  it("docks 8 px inside a zone and leaves 8 px past it", () => {
    // b's zone runs from its top (150) to 24 px under its strip (210).
    expect(play(torn(), [[1250, 204]]).carried.kind).toBe("open");
    const over = play(torn(), [[1250, 201]]);
    expect(over.carried.kind).toBe("docked");
    expect(play(over, [[1250, 217]]).carried.kind).toBe("docked");
    expect(play(over, [[1250, 219]]).carried.kind).toBe("open");
  });

  it("isn't caught by a strip under another of our windows", () => {
    // c's strip (300..336) is under a's body.
    expect(play(torn(), [[400, 320]]).carried.kind).toBe("open");
  });

  it("back in its own strip, reorders among the others", () => {
    // Without t2 the strip closes up: t1's middle is at 240, t3's at 364.
    const home = play(torn(), [
      [380, 140],
      [380, 118],
    ]);
    expect(home.carried).toMatchObject({ kind: "docked", window: "a", slot: 2 });
    expect(play(home, [[350, 118]]).carried).toMatchObject({ slot: 1 });
    // It lands after t3, where t2 was before.
    expect(release(home)).toEqual({
      kind: "reorder",
      slot: 2,
      chip: { x: 428, y: 106, width: 120, height: 24 },
    });
  });

  it("goes home on Esc", () => {
    expect(cancel()).toEqual({ kind: "home" });
  });

  it("follows the latest sample: in and out of a strip, it is the preview again where the hand is", () => {
    const out = play(torn(), [
      [1250, 165],
      [1300, 165],
      [800, 600],
    ]);
    expect(out.carried).toMatchObject({
      kind: "open",
      frame: { x: 800 - 60 - 80, y: 600 - 12 - 6 },
    });
  });
});

describe("spring-load", () => {
  it("brings forward a window not in front once the chip has rested in its strip", () => {
    const over = play(torn(), [[1250, 165]]);
    const since = over.at;
    expect(tick(over, since + 349).raised).toBeNull();
    const raised = tick(over, since + 350);
    expect(raised.raised).toBe("b");
    expect(raised.order[0]).toBe("b");
    // Told once: resting on, it isn't brought forward again.
    expect(tick(raised, since + 900).order).toEqual(raised.order);
  });

  it("starts over when the chip leaves the strip", () => {
    const over = play(torn(), [[1250, 165]]);
    const back = play(
      over,
      [
        [1250, 400],
        [1250, 165],
      ],
      over.at + 300,
    );
    expect(tick(back, over.at + 400).raised).toBeNull();
  });

  it("leaves the window in front alone", () => {
    const home = play(torn(), [[500, 118]]);
    expect(tick(home, home.at + 1000).raised).toBeNull();
  });
});

describe("a one-tab window", () => {
  const D = place("d", { x: 200, y: 200, width: 600, height: 500 }, ["d1"]);
  const alone: CarryGeometry = { windows: [D, B], displays: [LAPTOP, MONITOR] };
  const start = { window: "d", tabId: "d1", press: { x: 340, y: 218 }, onlyTab: true };

  it("carries the window itself, 1:1, its own strip never catching it", () => {
    const moved = play(carried(start, alone), [
      [345, 218],
      [345, 230],
      [420, 300],
    ]);
    expect(moved.carried).toEqual({
      kind: "open",
      frame: { x: 280, y: 282, width: 600, height: 500 },
    });
    expect(release(moved)).toEqual({
      kind: "moved",
      frame: { x: 280, y: 282, width: 600, height: 500 },
    });
  });

  it("docks in another window's strip like any tab", () => {
    const over = play(carried(start, alone), [
      [345, 218],
      [1250, 165],
    ]);
    expect(over.carried).toMatchObject({ kind: "docked", window: "b", slot: 1 });
    expect(release(over)).toMatchObject({ kind: "strip", window: "b", slot: 1 });
  });
});

describe("motion", () => {
  const banding = { kind: "banding", offset: 0, slot: 1, pulled: 7 } as const;
  const open = { kind: "open", frame: A.frame } as const;
  const docked = { kind: "docked", window: "b", slot: 1, chip: A.frame } as const;

  it("unfolds a chip into the preview and folds it back, or fades with Reduce Motion", () => {
    expect(morphOf(banding, open, false)).toBe("unfold");
    expect(morphOf(open, docked, false)).toBe("settle");
    expect(morphOf(docked, open, false)).toBe("unfold");
    expect(morphOf(banding, docked, false)).toBe("nudge");
    expect(morphOf(banding, open, true)).toBe("fade");
    expect(morphOf(open, docked, true)).toBe("fade");
    expect(morphOf(banding, docked, true)).toBeNull();
    expect(morphOf({ kind: "pressed" }, banding, false)).toBeNull();
    expect(morphOf(docked, { ...docked, slot: 2 }, false)).toBeNull();
  });

  it("lands a chip, fades a still off a new window, or fades with Reduce Motion", () => {
    const chip = A.frame;
    expect(landingMotion({ kind: "strip", window: "b", slot: 1, chip }, false)).toBe("land");
    expect(landingMotion({ kind: "home" }, false)).toBe("land");
    expect(landingMotion({ kind: "window", frame: chip, display: null }, false)).toBe("flick");
    expect(landingMotion({ kind: "home" }, true)).toBe("fade");
    expect(landingMotion({ kind: "click" }, false)).toBeNull();
  });
});

describe("the preview's size", () => {
  const workArea = LAPTOP.workArea;

  it("is the tab's last window size, else the source's while it's roomy, else 75 % of the display", () => {
    const last = { width: 640, height: 480 };
    expect(previewSize(last, A.frame, workArea)).toEqual(last);
    expect(previewSize(null, A.frame, workArea)).toEqual({ width: 900, height: 700 });
    const full = { x: 0, y: 33, width: 1512, height: 949 };
    expect(previewSize(null, full, workArea)).toEqual({ width: 1134, height: 712 });
  });
});

describe("slotAt", () => {
  const chips = [0, 124, 248].map((x) => ({ x, y: 0, width: 120, height: 24 }));

  it("counts the middles left of the hand, and moves from a slot only 8 px past one", () => {
    expect(slotAt(chips, 61, null)).toBe(1);
    expect(slotAt(chips, 59, null)).toBe(0);
    expect(slotAt(chips, 67, 0)).toBe(0);
    expect(slotAt(chips, 69, 0)).toBe(1);
    expect(slotAt(chips, 53, 1)).toBe(1);
    expect(slotAt(chips, 51, 1)).toBe(0);
    expect(slotAt(chips, 400, 0)).toBe(3);
  });
});
