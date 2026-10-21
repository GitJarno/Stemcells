// The window: a usage limit reset and Cells carried on by themselves.
// Beside Aski a shut window's blind goes up, and the Cells that waited
// behind it go on out, one by one.

import { type Grid, type Stage } from "../grid.ts";
import { ease, lerp, sstep, unlerp } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf, write } from "./stage.ts";

/** The most Cells drawn. */
const MOST = 5;
/** Seconds: the blind goes up from `up` until `open`; the first Cell leaves at `first`, the next each `every` after, each `goes` long. */
export const WINDOW = { up: 0.5, open: 1.5, first: 1.7, every: 0.3, goes: 0.9 } as const;
/** The window's inside, in cells. */
const INSIDE = { width: 5, height: 3 } as const;

/** What `cells` carried on say. */
export const windowLine = (cells: number): string =>
  cells === 1
    ? words["moment.window.one"]
    : words["moment.window.many"].replace("{n}", String(cells));

export function windowOpen(cells = 2, seed = 7): SceneCard {
  const count = Math.max(1, Math.min(cells, MOST)),
    line = windowLine(cells),
    gone = WINDOW.first + (count - 1) * WINDOW.every + WINDOW.goes,
    say = gone + 0.3,
    end = say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;
  const out = (t: number, k: number): number =>
    unlerp(WINDOW.first + k * WINDOW.every, WINDOW.first + k * WINDOW.every + WINDOW.goes, t);

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      sq = squareOf(stage),
      ink = sstep(0, 0.3, t) * (1 - sstep(end - 0.8, end - 0.2, t));
    if (ink <= 0) return g;
    const right = Math.floor(sq.left) - 3,
      left = right - INSIDE.width - 1,
      top = Math.round(sq.middle) - Math.ceil(INSIDE.height / 2) - 1,
      bottom = top + INSIDE.height + 1;
    const rule = `+${"-".repeat(INSIDE.width)}+`;
    write(g, left, top, rule, ink);
    write(g, left, bottom, rule, ink);
    // The blind, up from the sill: the rows still down are shut.
    const down = Math.round(
      INSIDE.height * (1 - ease.inOutCubic(unlerp(WINDOW.up, WINDOW.open, t))),
    );
    for (let r = 1; r <= INSIDE.height; r++) {
      write(g, left, top + r, "|", ink);
      write(g, right, top + r, "|", ink);
      if (r <= down) write(g, left + 1, top + r, "#".repeat(INSIDE.width), ink);
    }
    // The Cells that waited, each going on out to the left.
    for (let k = 0; k < count; k++) {
      const v = out(t, k);
      if (v >= 1) continue;
      const from = right - 1 - (k % INSIDE.width),
        row = top + 1 + (k % INSIDE.height);
      if (row <= top + down) continue;
      const x = lerp(from, left - 6, ease.inCubic(v));
      write(g, x, row, "o", ink * (1 - sstep(0.6, 1, v)));
    }
    return g;
  }

  return {
    id: "window",
    seed,
    beats: { ...WINDOW, gone, say },
    end,
    // The blind up and the first Cell on its way out.
    still: WINDOW.first + WINDOW.goes / 2,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, gone + 0.1),
    eyesAt: (t, stage) => {
      const look = sstep(0.2, WINDOW.up, t) * (1 - sstep(gone, say, t));
      return look > 0 ? eyesLooking(stage, [-7 * look, 0]) : null;
    },
    mood: (t) => (t >= gone && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
