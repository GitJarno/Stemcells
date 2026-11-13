// A feat's rarity as one hue, in the phone's own tokens for the Mac's
// (`apps/web/src/stemcells/collection/collection.css`): common the muted ink, rare its info
// (sky), legendary its warning, secret the Cell tone (indigo). Whole class names, so the
// style sheet's build finds each.

import type { Rarity } from "./kit";

export interface Hue {
  /** The rarity's word. */
  readonly ink: string;
  /** The floor a tile's Cell stands on: a wash of the hue over a rule of it. */
  readonly floor: string;
  /** A progress bar's track, and what fills it; the fill is a card's leading edge too. */
  readonly track: string;
  readonly fill: string;
}

export const HUES: Readonly<Record<Rarity, Hue>> = {
  common: {
    ink: "text-foreground-muted",
    floor: "border-foreground-muted bg-foreground-muted/7",
    track: "bg-foreground-muted/18",
    fill: "bg-foreground-muted",
  },
  rare: {
    ink: "text-adaptive-sky-600-400",
    floor: "border-adaptive-sky-600-400 bg-adaptive-sky-600-400/7",
    track: "bg-adaptive-sky-600-400/18",
    fill: "bg-adaptive-sky-600-400",
  },
  legendary: {
    ink: "text-warning-foreground",
    floor: "border-warning-foreground bg-warning-foreground/7",
    track: "bg-warning-foreground/18",
    fill: "bg-warning-foreground",
  },
  secret: {
    ink: "text-adaptive-indigo-600-300",
    floor: "border-adaptive-indigo-600-300 bg-adaptive-indigo-600-300/7",
    track: "bg-adaptive-indigo-600-300/18",
    fill: "bg-adaptive-indigo-600-300",
  },
};

/** A feat new since it was last shown: the phone's token for the Mac's success. */
export const NEW_DOT = "bg-stage-done";
