// A scene is a card and a picture. The card says what it is: its beats, the one
// moment reduced motion holds, the lines it may say. `frame(t, stage)` draws any
// moment of it as a grid, and is pure: the same seed, stage and time always give
// the same grid, and nothing is carried from one frame to the next, so a scene
// plays, seeks, skips to its still and renders offline alike.
//
// What every scene shares lives here: where Aski stands on a stage, the field
// its cloud is cut from, a form spelled in its own name, and the cloud at rest.

import { BODY_HEIGHT, LOBES } from "./canon.ts";
import { RAMP } from "./font.ts";
import { type Grid, isPrintable, makeGrid, put, type Stage } from "./grid.ts";
import { clamp } from "./math.ts";
import type { Mood } from "./mood.ts";
import { restDistance } from "./particles.ts";

export interface SceneCard {
  readonly id: string;
  readonly seed: number;
  /** Named moments, in seconds from the start. */
  readonly beats: Readonly<Record<string, number>>;
  /** Where it ends: Aski is home by then. */
  readonly end: number;
  /** The moment reduced motion shows, held still. */
  readonly still: number;
  /** What may be said over it, from the string catalog (`strings/en.json`), eight words at most each. */
  readonly lines: readonly string[];
  /** True when it opens on Aski at rest, false when it opens on an empty stage. */
  readonly home: boolean;
  /**
   * How open Aski's eyes are at t, 0..1, where it stands at home; 0 draws none,
   * and they are open on the still. The eyes are never cells: a renderer draws
   * them over the grid and the cells under them step aside, so every form keeps
   * them and the eye can change shape without changing a scene.
   */
  eyes(t: number): number;
  /**
   * Where the eyes are at t when a form other than the cloud at home wears them
   * (a koi, a face); null, or no such function, while they sit at home. `eyes(t)`
   * still says how open, and 0 still draws none.
   */
  eyesAt?(t: number, stage: Stage): EyePlace | null;
  /** The mood typed into the eyes at t, as the figure types one; none, or no such function, draws the blocks. */
  mood?(t: number): Mood | undefined;
  frame(t: number, stage: Stage): Grid;
}

/** The eyes away from home: each one's ink centre in cells (column, row), left one first, and how tall they are in rows. */
export interface EyePlace {
  readonly at: readonly [readonly [number, number], readonly [number, number]];
  readonly rows: number;
}

/** A cell is about half as wide as it is tall: a monospace character on its line. */
export const CELL_ASPECT = 0.5;

const BODY_LEFT = Math.min(...LOBES.map((l) => l.x - l.r)),
  BODY_RIGHT = Math.max(...LOBES.map((l) => l.x + l.r));
export const BODY_WIDTH = BODY_RIGHT - BODY_LEFT;
/** The middle of Aski's ink box, canon units. */
export const BODY_MID = { x: (BODY_LEFT + BODY_RIGHT) / 2, y: -BODY_HEIGHT / 2 } as const;

/** How canon space lies on a grid. */
export interface Fit {
  /** The column, in cells, of canon x = 0. */
  readonly cx: number;
  /** The row line, in cells, of the ground (canon y = 0). */
  readonly ground: number;
  /** Cells per canon unit, across and down. */
  readonly kx: number;
  readonly ky: number;
}

/** Where Aski stands on a stage when it is home: centred, feet low, about two thirds of the stage tall. */
export function homeFit(stage: Stage): Fit {
  const ky = Math.min(
    (stage.rows * 0.68) / BODY_HEIGHT,
    (stage.cols * CELL_ASPECT * 0.62) / BODY_WIDTH,
  );
  return { cx: stage.cols / 2, ground: stage.rows * 0.86, kx: ky / CELL_ASPECT, ky };
}

/** The canon point under the centre of cell (i, j). */
export const cellToCanon = (f: Fit, i: number, j: number): [number, number] => [
  (i + 0.5 - f.cx) / f.kx,
  (j + 0.5 - f.ground) / f.ky,
];

/** The field every form of the cloud is cut from: true inside Aski's resting body, canon units. */
export const inCloud = (x: number, y: number): boolean => restDistance(x, y) < 0;

/** The cells of a stage where `inside` holds, in reading order, as indices j * cols + i. */
export function region(stage: Stage, inside: (i: number, j: number) => boolean): number[] {
  const out: number[] = [];
  for (let j = 0; j < stage.rows; j++)
    for (let i = 0; i < stage.cols; i++) if (inside(i, j)) out.push(j * stage.cols + i);
  return out;
}

/** The cells Aski's body covers, fitted to a stage (home, unless told otherwise). */
export const cloudCells = (stage: Stage, fit: Fit = homeFit(stage)): number[] =>
  region(stage, (i, j) => inCloud(...cellToCanon(fit, i, j)));

/**
 * A form spelled in its own name: the n-th cell of a region, in reading order,
 * shows the word's n-th letter, round and round.
 */
export function spell(cells: readonly unknown[], word: string): string[] {
  if (!word || ![...word].every((c) => isPrintable(c) && c !== " "))
    throw new RangeError(`A form is spelled in one word: ${JSON.stringify(word)}`);
  return cells.map((_, n) => word[n % word.length]!);
}

/** A density 0..1 as a character, from light to heavy. */
export const rampChar = (density: number): string =>
  RAMP[Math.round(clamp(density, 0, 1) * (RAMP.length - 1))]!;

/** Aski at rest on a stage: every cell of its cloud at full ink, spelled `aski`. Every scene ends here. */
export function cloudAtRest(stage: Stage): Grid {
  const g = makeGrid(stage),
    cells = cloudCells(stage),
    letters = spell(cells, "aski");
  for (const [n, k] of cells.entries())
    put(g, k % stage.cols, Math.floor(k / stage.cols), letters[n]!, 1);
  return g;
}
