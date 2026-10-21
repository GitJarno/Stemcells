// Pages: a Cell compacted its chat on its own. Beside Aski a tall stack of
// pages folds down to a few; the thread from them to Aski stays as it was.

import { type Grid, type Stage } from "../grid.ts";
import { ease, lerp, sstep, unlerp } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { TYPING, typingFor } from "./line.ts";
import { blinkFrom, eyesLooking, squareOf, write } from "./stage.ts";

/** Seconds: the pages show by `shown`, fold from `fold` until `folded`; Aski is pleased from `pleased` and speaks at `say`. */
export const PAGES = { shown: 0.4, fold: 0.9, folded: 2.0, pleased: 2.2, say: 2.6 } as const;
/** A page, and the most pages drawn. */
const PAGE = "========";
const MOST = 7;

export function pages(seed = 7): SceneCard {
  const line = words["moment.pages"],
    end = PAGES.say + (typingFor(line) + TYPING.hold) / 1000 + 0.8;

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage),
      sq = squareOf(stage),
      ink = sstep(0, PAGES.shown, t) * (1 - sstep(end - 0.8, end - 0.2, t));
    if (ink <= 0) return g;
    const mid = Math.round(sq.middle),
      reach = Math.max(
        1,
        Math.min(Math.floor((MOST - 1) / 2), Math.floor((sq.bottom - sq.top) / 2)),
      ),
      tall = reach * 2 + 1,
      to = Math.floor(sq.left) - 2,
      thread = 6,
      left = to - thread - PAGE.length,
      u = ease.inOutCubic(unlerp(PAGES.fold, PAGES.folded, t));
    // Each page folds toward the middle; those that meet are one.
    for (let k = 0; k < tall; k++) {
      const from = mid - reach + k,
        into = mid + Math.round(((k / (tall - 1)) * 2 - 1) * Math.min(1, reach));
      write(g, left, Math.round(lerp(from, into, u)), PAGE, ink);
    }
    // The thread, unbroken throughout.
    write(g, left + PAGE.length, mid, "~".repeat(thread), ink);
    return g;
  }

  return {
    id: "pages",
    seed,
    beats: { ...PAGES },
    end,
    still: PAGES.say,
    lines: [line],
    home: true,
    eyes: (t) => blinkFrom(t, PAGES.folded + 0.1),
    eyesAt: (t, stage) => {
      const look = sstep(0.1, PAGES.shown, t) * (1 - sstep(PAGES.folded, PAGES.pleased, t));
      return look > 0 ? eyesLooking(stage, [-7 * look, 0]) : null;
    },
    mood: (t) => (t >= PAGES.pleased && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
