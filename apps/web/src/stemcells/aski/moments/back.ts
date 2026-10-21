// Back: the server answers again after a silence and nothing failed in it.
// Aski's eyes are still the crash's `x x`, flicker back to the blocks, and
// it says so.

import type { Stage } from "../grid.ts";
import { cloudAtRest, type SceneCard } from "../scene.ts";
import words from "../strings/en.json" with { type: "json" };
import { blinkFrom } from "./stage.ts";

/** Seconds: crashed until `flicker`, flickering until `up`; the line from `say`. */
export const BACK = { flicker: 1.6, up: 2.4, say: 3.0, end: 7.0 } as const;
/** How long each flicker holds a face. */
const FLICK = 0.16;

export function back(seed = 7): SceneCard {
  return {
    id: "back",
    seed,
    beats: { ...BACK },
    end: BACK.end,
    still: BACK.say,
    lines: [words["moment.back"]],
    home: true,
    eyes: (t) => blinkFrom(t, BACK.up + 0.2),
    mood: (t) =>
      t < BACK.flicker || (t < BACK.up && Math.floor((t - BACK.flicker) / FLICK) % 2 === 1)
        ? "crashed"
        : undefined,
    frame: (_t, stage: Stage) => cloudAtRest(stage),
  };
}
