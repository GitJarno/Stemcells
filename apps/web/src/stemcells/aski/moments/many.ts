// Many: one message to Aski started five Cells or more. Each buds out of
// Aski in turn, named by the longest word of its title, and settles beside
// it within Aski's height; Aski watches each go.

import { type Grid, type Stage } from "../grid.ts";
import { ease, lerp, sstep, unlerp } from "../math.ts";
import { BODY_MID, cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, middleOf, squareOf, write } from "./stage.ts";

/** The most buds drawn, and the longest word a bud holds. */
const MOST = 9;
const LONGEST = 8;
/** Seconds: the first bud leaves at `first`, the next each `every` after, each `flies` long. */
const BUDS = { first: 0.5, every: 0.45, flies: 0.8 } as const;

/**
 * A Cell's word: the longest word of its title that a bud holds whole, the
 * first of equals; a title of only longer words gives its longest, cut.
 */
export function taskWord(title: string): string {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
  const longest = (of: readonly string[]): string | undefined =>
    of.reduce<string | undefined>(
      (best, w) => (w.length > (best?.length ?? 0) ? w : best),
      undefined,
    );
  const word = longest(words.filter((w) => w.length <= LONGEST)) ?? longest(words) ?? "cell";
  return word.slice(0, LONGEST);
}

/** A Cell's bud: its word between the parentheses a Cell's name wears. */
export const budOf = (title: string): string => `(${taskWord(title)})`;

/** Where bud `k` of `n` settles: on an arc to Aski's left, no higher or lower than Aski, in cells. */
function settle(stage: Stage, k: number, n: number): readonly [number, number] {
  const [mx] = middleOf(stage, [BODY_MID.x, BODY_MID.y]),
    sq = squareOf(stage);
  const reach = Math.max(8, Math.min(48, sq.left - 4));
  const angle = lerp(0.62, 1.38, n === 1 ? 0.5 : k / (n - 1)) * Math.PI;
  const tall = (sq.bottom - sq.top) / 2 / Math.sin(0.62 * Math.PI),
    y = (sq.top + sq.bottom) / 2 - Math.sin(angle) * tall;
  return [
    mx + Math.cos(angle) * (mx - sq.left + reach),
    Math.min(sq.bottom, Math.max(sq.top, Math.round(y))),
  ];
}

export function many(titles: readonly string[] = [], seed = 7): SceneCard {
  const buds = (titles.length > 0 ? titles : ["one", "two", "three", "four", "five"])
    .slice(0, MOST)
    .map(budOf);
  const landed = BUDS.first + (buds.length - 1) * BUDS.every + BUDS.flies,
    say = landed + 0.4,
    line = words["moment.many"],
    end = say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;
  const flight = (t: number, k: number): number =>
    ease.outCubic(unlerp(BUDS.first + k * BUDS.every, BUDS.first + k * BUDS.every + BUDS.flies, t));

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      [mx, my] = middleOf(stage, [BODY_MID.x, BODY_MID.y]),
      ink = 1 - sstep(end - 0.8, end - 0.2, t);
    for (const [k, bud] of buds.entries()) {
      const v = flight(t, k);
      if (v <= 0 || ink <= 0) continue;
      const [x, y] = settle(stage, k, buds.length);
      // Settled wholly left of Aski's square, clear of Aski and of the line.
      const at = Math.min(x, squareOf(stage).left - 2 - bud.length / 2);
      write(g, lerp(mx, at, v) - bud.length / 2, lerp(my, y, v), bud, ink);
    }
    return g;
  }

  return {
    id: "many",
    seed,
    beats: { landed, say },
    end,
    still: say,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, landed + 0.1),
    // The eyes follow each bud out as it flies.
    eyesAt: (t, stage) => {
      const k = buds.findIndex((_, n) => {
        const v = flight(t, n);
        return v > 0 && v < 1;
      });
      if (k < 0) return null;
      const [mx, my] = middleOf(stage, [BODY_MID.x, BODY_MID.y]),
        [x, y] = settle(stage, k, buds.length),
        far = Math.hypot(x - mx, (y - my) * 2) || 1;
      return eyesLooking(stage, [(7 * (x - mx)) / far, (6 * (y - my) * 2) / far]);
    },
    frame,
  };
}
