// What the app knows of a Cell (its mood, its work, its strength, its provider)
// as what the model plays: an act, how grown it is, and its colour.

import type { Activity } from "../activity.ts";
import { bodyOf } from "../cast.ts";
import { paletteOf, type Strength } from "../kit.ts";
import type { Mood } from "../look.ts";
import type { Act } from "./acts.ts";
import type { Rgb } from "./tones.ts";

/** Only an edit puts its hands on the keys; other work it watches on the screen. */
export function actOf(mood: Mood, activity: Activity | undefined): Act {
  if (mood === "needsYou" || mood === "needsApproval") return "asking";
  if (mood === "pleased") return "landed";
  if (mood === "asleep") return "asleep";
  if (mood === "meditating") return "thinking";
  if (mood !== "awake" || activity === undefined) return "rest";
  if (activity === "thinking") return "thinking";
  return activity === "editing" ? "writing" : "watching";
}

const GROWN: Readonly<Record<Strength, number>> = { nubs: 0.35, arms: 0.7, biceps: 1 };

/** A Cell grows with the strength it earned working alone (`growth.ts`). */
export const grownOf = (strength: Strength | undefined): number =>
  strength === undefined ? 0 : GROWN[strength];

/** The colour of the body called `body` in the kit's palette. */
export function hueOfBody(body: string): Rgb {
  const hex = paletteOf(body).B ?? "#FF8154";
  const channel = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

/** A provider's colour. */
export const hueOf = (provider: string | null | undefined): Rgb => hueOfBody(bodyOf(provider));

/** A number in 0 to 1 a name always gives: when its Cell breathes and blinks. */
export const seedOf = (name: string) =>
  [...name].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) % 9973, 7) / 9973;
