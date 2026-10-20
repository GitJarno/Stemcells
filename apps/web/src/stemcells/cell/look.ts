// A Cell's moods, its box, the Cell as a mark in one ink, and the marks a
// project's line in the left column draws for its Cells.

import { sceneFor } from "./cast.ts";
import { MINI } from "./kit.ts";
import { packLook } from "./scene.ts";

/** The faces a character wears. */
export type Mood = "awake" | "needsYou" | "asleep" | "pleased" | "crashed" | "braced";

export const MOODS: readonly Mood[] = [
  "awake",
  "needsYou",
  "asleep",
  "pleased",
  "crashed",
  "braced",
];

/** CSS pixels a cell of a Cell's miniature is drawn where it stands large: on a 2× display, its hero art at one device pixel a cell. */
export const POINTS_PER_PIXEL = 2;

/** The mood a screen draws for the word core sent: one it does not know draws as awake. */
export function moodOf(word: string | undefined): Mood {
  return MOODS.find((mood) => mood === word) ?? "awake";
}

/** A Cell's box in cells of its miniature, hats and all: columns, rows. Every surface measures a Cell by it. */
export const BOX = { width: MINI.rows[0]?.length ?? 0, height: MINI.rows.length } as const;

/** The bare Cell's hero art in a mood, held still. */
const pictureIn = (mood: Mood): readonly string[] =>
  sceneFor(packLook([]), mood, undefined, 0).mini[0]?.detail ?? [];

const filled = (row: string) => /[^.]/.test(row);
const STANDING = pictureIn("awake");
const TOP = STANDING.findIndex(filled);

/** The Cell as a mark (`path`): the rows its body fills standing, in hero cells: columns, rows. */
export const SIZE = {
  width: STANDING[0]?.length ?? 0,
  height: STANDING.findLastIndex(filled) - TOP + 1,
} as const;

/** The body's own colours, which the mark fills; its face is cut out of it. */
const BODY = new Set(["B", "b", "L", "O"]);

/** The bare Cell in a mood as a mark in one ink: one SVG path on a grid of unit cells `SIZE` in size, each row's runs joined. */
export function path(mood: Mood): string {
  let d = "";
  pictureIn(mood)
    .slice(TOP, TOP + SIZE.height)
    .forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (!BODY.has(row[x]!)) continue;
        let end = x;
        while (BODY.has(row[end + 1] ?? "")) end++;
        d += `M${x} ${y}h${end - x + 1}v1H${x}z`;
        x = end;
      }
    });
  return d;
}

/**
 * A Cell on its project's line in the main window's left column, in its provider's hue: a
 * core while it starts or works, the core with "?" cut through it while it asks, a dot once it has landed unread, a
 * faint dot once read. The shape says the state; the hue says whose Cell it is.
 */
export type Core = "core" | "asks" | "unread" | "read";

/** The core for a stage. */
export function coreOf(stage: string, unread: boolean): Core {
  if (stage === "starting" || stage === "working") return "core";
  if (stage === "needsYou") return "asks";
  return stage === "landed" && unread ? "unread" : "read";
}

const KEPT: Record<Core, number> = { asks: 0, core: 1, unread: 2, read: 3 };
const DRAWN: Record<Core, number> = { core: 0, asks: 1, unread: 2, read: 3 };

/**
 * The Cells a project's line marks, at most `most`: what asks first, then the newest at work, then the landed. They
 * are drawn the cores first, oldest to newest, then what asks, in front of them, then the dots after.
 */
export function lineMarks<
  T extends { readonly stage: string; readonly unread: boolean; readonly bornAt: number },
>(cells: readonly T[], most: number): T[] {
  const core = (cell: T): Core => coreOf(cell.stage, cell.unread);
  const kept = [...cells]
    .sort((a, b) => KEPT[core(a)] - KEPT[core(b)] || b.bornAt - a.bornAt)
    .slice(0, most);
  return kept.sort((a, b) => DRAWN[core(a)] - DRAWN[core(b)] || a.bornAt - b.bornAt);
}

/** A Cell's stage as one mark: a ring while it starts or works, a dot while it needs you or is landed and unread. */
export type Orb = { readonly shape: "ring" | "dot"; readonly tone: "dim" | "working" | "needsYou" };

/** The orb for a stage: the ring in `dim`, then `working`; the amber dot; the unread dot; nothing once read. */
export function orbOf(stage: string, unread: boolean): Orb | undefined {
  switch (stage) {
    case "starting":
      return { shape: "ring", tone: "dim" };
    case "working":
      return { shape: "ring", tone: "working" };
    case "needsYou":
      return { shape: "dot", tone: "needsYou" };
    case "landed":
      return unread ? { shape: "dot", tone: "working" } : undefined;
    default:
      return undefined;
  }
}
