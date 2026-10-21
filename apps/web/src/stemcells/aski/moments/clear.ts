// All clear: several asks were waiting on the person and they answered
// them all, soon. The asks stand beside Aski as `!` marks, its eyes
// blinking like a cursor while they wait; one by one they go, and Aski is
// pleased. It says nothing: the list of what needs the person says it as
// it empties, and one line is enough.

import { type Grid, type Stage } from "../grid.ts";
import { sstep } from "../math.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import { cursorOpen, squareOf, write } from "./stage.ts";

/** The most marks drawn: past this many, the picture says "many" as well as more would. */
const MOST = 9;
/** Seconds: the marks come in by `in`, the first goes at `first`, the next each `every` after. */
const MARKS = { in: 0.4, first: 0.9, every: 0.5 } as const;
/** How long Aski stays pleased once the last has gone, in seconds. */
const PLEASED = 2.4;

/** When the last of `n` marks has gone. */
const goneBy = (n: number): number => MARKS.first + (Math.min(n, MOST) - 1) * MARKS.every + 0.2;

export function clear(asks = 3, seed = 7): SceneCard {
  const marks = Math.max(1, Math.min(asks, MOST)),
    gone = goneBy(marks),
    end = gone + 0.2 + PLEASED + 1;

  function frame(t: number, stage: Stage): Grid {
    const g = cloudAtRest(stage);
    const sq = squareOf(stage);
    for (let k = 0; k < marks; k++) {
      const out = MARKS.first + k * MARKS.every;
      if (t >= out + 0.2) continue;
      // The nearest goes first; each fades through a dot.
      write(g, sq.left - 3 - k * 2, sq.eyes, t >= out ? "." : "!", sstep(0, MARKS.in, t));
    }
    return g;
  }

  return {
    id: "clear",
    seed,
    beats: { gone },
    end,
    // The marks gone, Aski pleased.
    still: gone + 0.6,
    lines: [],
    home: true,
    // A cursor's blink while anything waits, then wide open.
    eyes: (t) => (t > 0 && t < gone && !cursorOpen(t) ? 0.07 : 1),
    mood: (t) => (t >= gone + 0.2 && t < end - 1 ? "pleased" : undefined),
    frame,
  };
}
