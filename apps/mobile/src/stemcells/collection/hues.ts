// A feat's rarity as one hue, the Mac's (`apps/web/src/stemcells/collection/collection.css`):
// common the muted ink, rare blue, legendary orange, secret purple
// (`../home/stageColours.ts`). Whole class names, so the style sheet's build finds each.

import type { Rarity } from "./kit";

export interface Hue {
  /** The rarity's word. */
  readonly ink: string;
  /** An earned rung's dot. */
  readonly fill: string;
}

export const HUES: Readonly<Record<Rarity, Hue>> = {
  common: {
    ink: "text-foreground-muted",
    fill: "bg-foreground-muted",
  },
  rare: {
    ink: "text-rarity-rare",
    fill: "bg-rarity-rare",
  },
  legendary: {
    ink: "text-rarity-legendary",
    fill: "bg-rarity-legendary",
  },
  secret: {
    ink: "text-rarity-secret",
    fill: "bg-rarity-secret",
  },
};

/** A feat new since it was last shown: the phone's token for the Mac's success. */
export const NEW_DOT = "bg-stage-done";

/** A count's bar, in the words' own ink: its track, and what fills it. */
export const BAR = { track: "bg-foreground/12", fill: "bg-foreground" } as const;
