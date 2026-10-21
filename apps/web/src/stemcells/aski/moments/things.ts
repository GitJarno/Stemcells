// Things: a Cell Aski started landed with new files. One by one a letter
// leaves Aski and lands beside it as a file, and Aski is pleased.

import { type Grid, type Stage } from "../grid.ts";
import { ease, lerp, sstep, unlerp } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf, write } from "./stage.ts";

/** The most files drawn. */
const MOST = 9;
/** Seconds: the first letter leaves at `first`, the next each `every` after, each `flies` long. */
const LETTERS = { first: 0.4, every: 0.35, flies: 0.7 } as const;
/** A file as it lands. */
const FILE = "[=]";

/** What `files` new files say. */
export const thingsLine = (files: number): string =>
  files === 1
    ? words["moment.things.one"]
    : words["moment.things.many"].replace("{n}", String(files));

/** Where file `k` lands: in columns of three left of Aski's square, nearest first, in cells. */
function spot(stage: Stage, k: number): readonly [number, number] {
  const sq = squareOf(stage),
    column = Math.floor(k / 3),
    row = (k % 3) - 1;
  const step = Math.max(1, Math.floor((sq.bottom - sq.top) / 4));
  return [
    Math.floor(sq.left) - 3 - FILE.length - column * (FILE.length + 2),
    Math.round(sq.middle + row * step),
  ];
}

export function things(files = 3, seed = 7): SceneCard {
  const count = Math.max(1, Math.min(files, MOST)),
    line = thingsLine(files),
    landed = LETTERS.first + (count - 1) * LETTERS.every + LETTERS.flies,
    say = landed + 0.5,
    end = say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;
  const flight = (t: number, k: number): number =>
    unlerp(LETTERS.first + k * LETTERS.every, LETTERS.first + k * LETTERS.every + LETTERS.flies, t);

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      sq = squareOf(stage),
      ink = 1 - sstep(end - 0.8, end - 0.2, t);
    if (ink <= 0) return g;
    for (let k = 0; k < count; k++) {
      const v = flight(t, k);
      if (v <= 0) continue;
      const [x, y] = spot(stage, k);
      if (v >= 1) {
        write(g, x, y, FILE, ink);
        continue;
      }
      // A word's letter on its way, from Aski's edge.
      const u = ease.outCubic(v);
      write(g, lerp(sq.left - 1, x + 1, u), lerp(sq.middle, y, u), "aski"[k % 4]!, ink);
    }
    return g;
  }

  return {
    id: "things",
    seed,
    beats: { landed, say },
    end,
    still: say,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, landed + 0.1),
    // The eyes follow each letter out.
    eyesAt: (t, stage) => {
      const k = Array.from({ length: count }, (_, n) => n).find((n) => {
        const v = flight(t, n);
        return v > 0 && v < 1;
      });
      if (k === undefined) return null;
      const sq = squareOf(stage),
        [, y] = spot(stage, k);
      return eyesLooking(stage, [-7, Math.sign(y - sq.middle) * 3]);
    },
    mood: (t) => (t >= landed + 0.3 && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
