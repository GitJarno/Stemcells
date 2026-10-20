// What a Cell plays for its mood, in whose colours, and which picture it
// shows at a moment: the original app's casting over the kit's scenes.

import type { Activity } from "./activity.ts";
import { isBlinking } from "./blink.ts";
import { type Pose, REST } from "./kit.ts";
import type { Mood } from "./look.ts";
import {
  type CellLook,
  type CellScene,
  type MiniFrame,
  onBeat,
  sceneOf,
  stillOf,
} from "./scene.ts";

/** The body a provider's Cells wear (`kit/palette.json`): Codex, Kimi and Gemini their own, every other the coral Cell. */
export function bodyOf(provider: string | null | undefined): string {
  switch (provider) {
    case "codex":
    case "openai":
    case "gpt":
      return "codex";
    case "kimi":
    case "moonshot":
      return "kimi";
    case "gemini":
    case "google":
      return "gemini";
    default:
      return "claude";
  }
}

/** The faces a mood holds still: dazed once its run failed (`x x`), hunkered down braced (`> <`). */
const HELD: Partial<Readonly<Record<Mood, Pose>>> = {
  crashed: { ...REST, eyes: "dizzy", mouth: "wavy" },
  braced: { ...REST, sy: 0.86, spread: 0.6, eyes: "squeeze" },
};

/** A long think shows the calm ponder and the head scratch in turn, this long each. */
const PONDER_SECONDS = 20;

/** The scene in the kit a mood plays: at work, what it is doing, else listening; the plea, asleep, the cheer. */
function sceneKey(mood: Mood, activity: Activity | undefined, seconds: number): string {
  switch (mood) {
    case "needsYou":
      return "waiting";
    case "asleep":
      return "asleep";
    case "pleased":
      return "happy";
    default:
      if (activity === undefined) return "idle";
      return activity === "thinking"
        ? `thinking/${Math.floor(seconds / PONDER_SECONDS) & 1}`
        : `${activity}/0`;
  }
}

/** What a Cell in `look` plays in `mood` doing `activity`, at `seconds` (`clockSeconds`; 0 held still). */
export function sceneFor(
  look: CellLook,
  mood: Mood,
  activity: Activity | undefined,
  seconds: number,
): CellScene {
  const held = HELD[mood];
  if (held !== undefined) return stillOf(look, `held:${mood}`, held);
  return sceneOf(look, sceneKey(mood, activity, seconds)) ?? sceneOf(look, "idle")!;
}

/**
 * The miniature `scene` shows at `seconds` on the clock, its eyes shut while
 * the Cell `seed` names blinks (`pleading`, on the caret's beat); with no
 * time, held still: its first frame, eyes open.
 */
export function frameShown(
  scene: CellScene,
  seed: string,
  seconds: number | undefined,
  pleading: boolean,
): MiniFrame {
  if (seconds === undefined) return scene.mini[0]!;
  const frames =
    scene.shut !== undefined && isBlinking(seed, seconds, pleading) ? scene.shut.mini : scene.mini;
  return frames[Math.trunc(seconds * onBeat(scene.fps)) % frames.length]!;
}

/**
 * The picture a miniature draws at `points` CSS pixels a cell on a display
 * of `dpr` device pixels a CSS pixel: its hero art at twice the density
 * wherever half a cell is whole device pixels (a 2× display, at 1 or 2
 * points), else the miniature itself.
 */
export function pictureOf(
  frame: MiniFrame,
  points: number,
  dpr: number,
): { readonly rows: readonly string[]; readonly density: 1 | 2 } {
  const pixels = (points / 2) * dpr;
  return pixels >= 1 && Math.abs(pixels - Math.round(pixels)) < 0.001
    ? { rows: frame.detail, density: 2 }
    : { rows: frame.rows, density: 1 };
}
