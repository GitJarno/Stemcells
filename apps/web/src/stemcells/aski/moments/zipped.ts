// Zipped: a Cell's pull request merged. Beside Aski a zipper lies open, as
// long as the change was big; its pull runs in to Aski and closes it, and
// Aski is pleased.

import { type Grid, type Stage } from "../grid.ts";
import { ease, sstep, unlerp } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf, write } from "./stage.ts";

/** Seconds: the zipper shows by `from`, its pull runs until `done`; Aski is pleased from `pleased` and speaks at `say`. */
export const ZIP = { from: 0.5, done: 2.4, pleased: 2.6, say: 3.0 } as const;
/** The zipper's length in cells: the shortest, and the longest. */
const LENGTH = { least: 8, most: 26 } as const;

/** What a merge into `base` says. */
export const zippedLine = (base: string): string => words["moment.zipped"].replace("{base}", base);

/** How long the zipper is for a change of `lines` lines: longer as it doubles. */
export const zipperFor = (lines: number): number =>
  Math.round(
    Math.min(LENGTH.most, Math.max(LENGTH.least, LENGTH.least + 2 * Math.log2(1 + lines / 50))),
  );

export function zipped(base = "main", lines = 300, seed = 7): SceneCard {
  const line = zippedLine(base),
    end = ZIP.say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;
  /** How far the pull has run, 0 to 1. */
  const pulled = (t: number): number => ease.inOutCubic(unlerp(ZIP.from, ZIP.done, t));

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      sq = squareOf(stage);
    const ink = sstep(0, ZIP.from, t) * (1 - sstep(end - 0.8, end - 0.2, t));
    if (ink <= 0) return g;
    const to = Math.floor(sq.left) - 3,
      long = Math.min(zipperFor(lines), to - 1),
      from = to - long,
      mid = Math.round(sq.middle),
      pull = Math.round(from + pulled(t) * long);
    for (let x = from; x <= to; x++) {
      if (x < pull) write(g, x, mid, "=", ink);
      else if (x > pull) {
        // Open past the pull, the rails parting as they go.
        const gap = Math.min(2, 1 + Math.floor((x - pull) / 5));
        write(g, x, mid - gap, "-", ink);
        write(g, x, mid + gap, "-", ink);
      }
    }
    write(g, pull, mid, ">", ink);
    return g;
  }

  return {
    id: "zipped",
    seed,
    beats: { ...ZIP },
    end,
    still: ZIP.say,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, ZIP.done + 0.1),
    // The eyes follow the pull in, from the zipper's far end.
    eyesAt: (t, stage) => {
      const look = sstep(0.1, ZIP.from, t) * (1 - sstep(ZIP.done, ZIP.pleased, t));
      return look > 0 ? eyesLooking(stage, [-7 * (1 - 0.7 * pulled(t)) * look, 0]) : null;
    },
    mood: (t) => (t >= ZIP.pleased && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
