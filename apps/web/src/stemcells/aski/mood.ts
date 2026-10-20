// A mood is a character Aski types into its eyes, as the canon has it: the
// two blocks give way to `^ ^` pleased, `- -` asleep, `? ?` puzzled, `! !`
// needs you, `> <` straining or `x x` crashed. The eyes stay where they are,
// the same size; only their shape changes.

import type { Frame } from "./aski.ts";

export type Mood = "pleased" | "asleep" | "puzzled" | "needsYou" | "straining" | "crashed";

/** The character each mood types into the eyes, left then right. */
export const MOODS: Readonly<Record<Mood, readonly [string, string]>> = {
  pleased: ["^", "^"],
  asleep: ["-", "-"],
  puzzled: ["?", "?"],
  needsYou: ["!", "!"],
  straining: [">", "<"],
  crashed: ["x", "x"],
};

/** The frame with `mood` typed into its eyes; the frame as it was without one. */
export function typed(frame: Frame, mood: Mood | undefined): Frame {
  if (mood === undefined) return frame;
  const [left, right] = MOODS[mood];
  return {
    ...frame,
    eyes: [
      { ...frame.eyes[0], glyph: left },
      { ...frame.eyes[1], glyph: right },
    ],
  };
}
