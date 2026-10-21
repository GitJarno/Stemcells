// A haul: a Cell worked an hour or more, watched from its start, and never
// once asked the person anything. Its work runs out beside Aski as one
// long unbroken line; Aski follows it and is pleased.

import { type Grid, type Stage } from "../grid.ts";
import { ease, sstep, unlerp } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf, write } from "./stage.ts";

/** Seconds: the line of work runs from `from` until `done`; Aski is pleased from `pleased`, and speaks at `say`. */
export const HAUL_TIMES = { from: 0.3, done: 2.6, pleased: 3.0, say: 3.4 } as const;
/** The longest the line of work runs, in cells. */
const LONGEST = 28;

/** What a haul of `hours` says. */
export const haulLine = (hours: number): string =>
  hours <= 1
    ? words["moment.haul.one"]
    : words["moment.haul.many"].replace("{n}", String(Math.floor(hours)));

export function haul(hours = 1, seed = 7): SceneCard {
  const line = haulLine(hours),
    end = HAUL_TIMES.say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      sq = squareOf(stage);
    const to = Math.floor(sq.left) - 3,
      long = Math.max(4, Math.min(LONGEST, to - 1)),
      run = Math.round(long * ease.outCubic(unlerp(HAUL_TIMES.from, HAUL_TIMES.done, t)));
    if (run === 0) return g;
    const ink = 1 - sstep(end - 0.8, end - 0.2, t);
    // Unbroken work: no mark in it where it stopped for the person.
    write(g, to - long, sq.middle, `${"=".repeat(run - 1)}${run < long ? ">" : "="}`, ink);
    return g;
  }

  return {
    id: "haul",
    seed,
    beats: { ...HAUL_TIMES },
    end,
    still: HAUL_TIMES.say,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, 1.6),
    eyesAt: (t, stage) => {
      const look = sstep(HAUL_TIMES.from, HAUL_TIMES.from + 0.3, t) - sstep(2.7, 3.0, t);
      return look > 0 ? eyesLooking(stage, [-7 * look, 0]) : null;
    },
    mood: (t) => (t >= HAUL_TIMES.pleased && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
