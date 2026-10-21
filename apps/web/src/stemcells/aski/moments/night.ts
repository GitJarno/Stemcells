// The night shift: the person looks in late and Cells are still at work.
// Aski goes faint and sleepy, three stars come out beside it, it looks up
// at them, says the night is the Cells', and wakes back to rest.

import { type Grid, put, type Stage } from "../grid.ts";
import { lerp, sstep } from "../math.ts";
import type { SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { blinkFrom, eyesLooking, middleOf, thinCloud } from "./stage.ts";

/** Seconds: fading until `faint`, stars from `stars`, the line from `say`, waking from `wake`. */
export const NIGHT = { faint: 2.2, stars: 1.2, say: 4.2, wake: 7.0, end: 8.4 } as const;

/** Where the stars come out, in canon units around Aski, and when each does after the first: the right one high, over the line. */
const STARS = [
  { at: [-185, -190], after: 0 },
  { at: [175, -215], after: 0.6 },
  { at: [-215, -95], after: 1.2 },
] as const;
/** A star's face as it comes out, then as it settles. */
const TWINKLE = [".", "+", "*", "+"] as const;

/** How far gone the night is at t: 0 at rest, 1 at its deepest. */
const deep = (t: number): number =>
  sstep(0.2, NIGHT.faint, t) - sstep(NIGHT.wake, NIGHT.end - 0.2, t);

export function night(seed = 7): SceneCard {
  function frame(t: number, stage: Stage): Grid {
    const g = thinCloud(stage, 0.55 * deep(t), seed);
    for (const star of STARS) {
      const u = t - NIGHT.stars - star.after,
        out = NIGHT.wake + star.after * 0.5;
      if (u < 0 || t >= out + 0.4) continue;
      const face = t >= out ? "." : TWINKLE[u < 0.15 ? 0 : u < 0.3 ? 1 : u < 0.6 ? 2 : 3]!;
      const [i, j] = middleOf(stage, star.at);
      put(g, Math.round(i), Math.round(j), face, 1);
    }
    return g;
  }

  return {
    id: "night",
    seed,
    beats: { ...NIGHT },
    end: NIGHT.end,
    // The last star is still bright, the eyes up at it.
    still: 2.8,
    lines: [words["moment.night"]],
    home: true,
    // Heavy-lidded through the night, one slow blink, wide awake again as it ends.
    eyes: (t) => Math.min(lerp(1, 0.45, deep(t)), blinkFrom(t, 5.6)),
    eyesAt: (t, stage) => {
      const up = sstep(NIGHT.stars, NIGHT.stars + 0.4, t) - sstep(3.4, 3.8, t);
      return up > 0 ? eyesLooking(stage, [0, -6 * up]) : null;
    },
    frame,
  };
}
