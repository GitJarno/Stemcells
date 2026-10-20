// A scene draws on a grid of character cells: one printable ASCII character and
// one ink per cell. Grids are plain data, so a scene can be pinned as text, and
// every renderer (the reference one here, the native ones later) draws the same
// grid the same way.

import { hash } from "./math.ts";

/**
 * A colour by role, besides plain ink: `warm` is for a scene's one living thing.
 * A renderer takes it from its palette.
 */
export type Tone = "warm";

export interface Cell {
  /** One printable ASCII character, or ' ' for an empty cell. */
  readonly ch: string;
  /** 0..1. An empty cell has none. */
  readonly ink: number;
  /** Its colour by role; plain ink when absent. An empty cell has none. */
  readonly tone?: Tone;
}

export interface Stage {
  readonly cols: number;
  readonly rows: number;
}

export interface Grid extends Stage {
  /** Row by row: the cell in column i of row j is cells[j * cols + i]. */
  readonly cells: Cell[];
}

export const BLANK: Cell = Object.freeze({ ch: " ", ink: 0 });

export function makeGrid({ cols, rows }: Stage): Grid {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1)
    throw new RangeError(`A stage is whole cells: ${cols}×${rows}`);
  return { cols, rows, cells: Array.from({ length: cols * rows }, () => BLANK) };
}

export const isPrintable = (ch: string): boolean => ch.length === 1 && ch >= " " && ch <= "~";
export const isEmpty = (c: Cell): boolean => c.ch === " " || !(c.ink > 0);

export function cellAt(g: Grid, i: number, j: number): Cell {
  return i >= 0 && j >= 0 && i < g.cols && j < g.rows ? g.cells[j * g.cols + i]! : BLANK;
}

/** Writes one cell; outside the stage it writes nothing. No ink, or a space, is an empty cell. */
export function put(g: Grid, i: number, j: number, ch: string, ink: number, tone?: Tone): void {
  if (!isPrintable(ch)) throw new RangeError(`Not one printable character: ${JSON.stringify(ch)}`);
  if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) return;
  g.cells[j * g.cols + i] =
    ch === " " || !(ink > 0)
      ? BLANK
      : tone
        ? { ch, ink: Math.min(ink, 1), tone }
        : { ch, ink: Math.min(ink, 1) };
}

export function sameGrid(a: Grid, b: Grid): boolean {
  if (a.cols !== b.cols || a.rows !== b.rows) return false;
  return a.cells.every(
    (c, k) => c.ch === b.cells[k]!.ch && c.ink === b.cells[k]!.ink && c.tone === b.cells[k]!.tone,
  );
}

/**
 * From grid a to grid b as u goes 0 → 1. Ink blends; where both cells hold a
 * character, each cell turns over at its own seeded moment, so a form changes
 * letter by letter rather than in one cut.
 */
export function crossfade(a: Grid, b: Grid, u: number, seed = 0): Grid {
  if (a.cols !== b.cols || a.rows !== b.rows)
    throw new RangeError("Crossfade needs two grids of one stage");
  if (u <= 0) return { cols: a.cols, rows: a.rows, cells: [...a.cells] };
  if (u >= 1) return { cols: b.cols, rows: b.rows, cells: [...b.cells] };
  const g = makeGrid(a);
  a.cells.forEach((ca, k) => {
    const cb = b.cells[k]!;
    if (isEmpty(ca) && isEmpty(cb)) return;
    const turned = u >= 0.15 + 0.7 * hash(seed, k, 71);
    const c = !isEmpty(cb) && (isEmpty(ca) || turned) ? cb : ca; // its tone turns over with its character
    put(g, k % a.cols, Math.floor(k / a.cols), c.ch, ca.ink + (cb.ink - ca.ink) * u, c.tone);
  });
  return g;
}

/** Ink as text: a blank for an empty cell, else 1–4 by quarters. */
const inkLevel = (c: Cell): string =>
  isEmpty(c) ? " " : String(Math.min(4, Math.max(1, Math.ceil(c.ink * 4))));

/**
 * The grid as text, for reading: its characters, then its ink in quarters,
 * then (only when a cell has one) its tones. Every row sits between bars, so no
 * line ends in a space.
 */
export function printGrid(g: Grid): string {
  const rows = (f: (c: Cell) => string) =>
    Array.from(
      { length: g.rows },
      (_, j) =>
        `|${g.cells
          .slice(j * g.cols, (j + 1) * g.cols)
          .map(f)
          .join("")}|`,
    );
  const tones = g.cells.some((c) => c.tone && !isEmpty(c))
    ? ["tone (w warm)", ...rows((c) => (c.tone === "warm" && !isEmpty(c) ? "w" : " "))]
    : [];
  return [
    `characters ${g.cols}x${g.rows}`,
    ...rows((c) => c.ch),
    "ink (quarters)",
    ...rows(inkLevel),
    ...tones,
    "",
  ].join("\n");
}
