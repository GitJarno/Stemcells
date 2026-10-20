// A Cell's character and orb, drawn from data (`cell.json`) so every screen
// draws the same pixels: the body in its provider's hue, its eyes cut out of
// it in the shape of its mood, and beside it the orb that marks its stage.

import { wornPixels } from "./looks.ts";
import look from "./cell.json" with { type: "json" };

/** The faces a character wears. */
export type Mood = "awake" | "needsYou" | "asleep" | "pleased" | "crashed" | "braced";

export const MOODS = Object.keys(look.moods) as Mood[];

/** The character's size in pixels: columns, rows. */
export const SIZE = { width: look.body[0]!.length, height: look.body.length } as const;

/** Each pixel is drawn this many points square, so its edges land on whole device pixels on every display. */
export const POINTS_PER_PIXEL = 2;

/** The mood a screen draws for the word core sent: one it does not know draws as the fallback. */
export function moodOf(word: string | undefined): Mood {
  return word !== undefined && Object.hasOwn(look.moods, word)
    ? (word as Mood)
    : (look.fallback as Mood);
}

const mirror = (rows: readonly string[]): string[] =>
  rows.map((row) => [...row].toReversed().join(""));

/** Where a mood's eyes are, as `x,y` pixel keys. */
function eyes(mood: Mood): Set<string> {
  const face: { left: readonly string[]; right?: readonly string[] } = look.moods[mood];
  const out = new Set<string>();
  const cut = (rows: readonly string[], [x, y]: readonly number[]) => {
    rows.forEach((row, dy) => {
      [...row].forEach((pixel, dx) => {
        if (pixel === "#") out.add(`${x! + dx},${y! + dy}`);
      });
    });
  };
  cut(face.left, look.eyes.left);
  cut(face.right ?? mirror(face.left), look.eyes.right);
  return out;
}

/** Every filled pixel of the character in a mood: the body, less its eyes. */
export function pixels(mood: Mood): [x: number, y: number][] {
  const holes = eyes(mood);
  const out: [number, number][] = [];
  look.body.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel === "#" && !holes.has(`${x},${y}`)) out.push([x, y]);
    });
  });
  return out;
}

/** The character in a mood as one SVG path on a grid of unit pixels, each row's runs joined. */
export function path(mood: Mood): string {
  const rows = new Map<number, number[]>();
  for (const [x, y] of pixels(mood)) rows.set(y, [...(rows.get(y) ?? []), x]);
  let d = "";
  for (const [y, xs] of rows) {
    let start = xs[0]!;
    for (let i = 1; i <= xs.length; i++) {
      if (xs[i] === xs[i - 1]! + 1) continue;
      d += `M${start} ${y}h${xs[i - 1]! - start + 1}v1H${start}z`;
      start = xs[i]!;
    }
  }
  return d;
}

/** What a Cell wears (`theme/piece` ids) as one SVG path per ink, on the character's pixel grid. */
export function wornPaths(worn: readonly string[]): [ink: string, d: string][] {
  const byInk = new Map<string, string>();
  for (const { x, y, ink } of wornPixels(worn))
    byInk.set(ink, `${byInk.get(ink) ?? ""}M${x} ${y}h1v1h-1z`);
  return [...byInk];
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
