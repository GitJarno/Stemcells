// A mark's glyph, cut from square blocks on a 7 × 7 grid as a Cell is: a sign each, no
// creature. Shared with the phone, which draws the same paths.

import type { MarkId } from "../../../../../stemcells/ledger/marks.ts";

const GLYPHS: Readonly<Record<MarkId, readonly string[]>> = {
  // A tick come to rest on the ground.
  "landed-alone": [".......", "......#", ".....#.", "#...#..", ".#.#...", "..#....", "#######"],
  // Two lines joined into one.
  merged: [".......", "##.....", "..#....", "...####", "..#....", "##.....", "......."],
  // A bar with a weight at each end.
  "long-haul": [".......", ".......", "##...##", "#######", "##...##", ".......", "......."],
  // One landing after another.
  "frequent-flyer": [".......", "#...#..", ".#...#.", "..#...#", ".#...#.", "#...#..", "......."],
  // A speech bubble with nothing in it.
  "radio-silence": [".......", ".#####.", ".#...#.", ".#...#.", ".#####.", "..#....", ".#....."],
  // A hat.
  "hat-trick": [".......", "..###..", "..###..", "..###..", "#######", ".......", "......."],
};

export const MARK_GLYPH_SIDE = 7;

/** One unit square per filled block. */
const pathOf = (rows: readonly string[]): string =>
  rows
    .flatMap((row, y) =>
      [...row].flatMap((block, x) => (block === "#" ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join("");

/** Each mark's glyph as one SVG path on a `MARK_GLYPH_SIDE` square. */
export const MARK_GLYPH_PATHS = Object.fromEntries(
  Object.entries(GLYPHS).map(([mark, rows]) => [mark, pathOf(rows)]),
) as Readonly<Record<MarkId, string>>;
