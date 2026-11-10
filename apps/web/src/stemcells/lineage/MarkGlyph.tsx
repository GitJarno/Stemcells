import "../tokens/stemcells.css";

import type { MarkId } from "../../../../../stemcells/ledger/marks.ts";

// A mark's glyph, cut from square blocks on a 7 × 7 grid as a Cell is, in one of our state
// hues. Three signs, no creature: a tick come to rest on the ground, two lines joined into
// one, a bar with a weight at each end.

const GLYPHS: Readonly<
  Record<MarkId, { readonly token: string; readonly rows: readonly string[] }>
> = {
  "landed-alone": {
    token: "--sc-success",
    rows: [".......", "......#", ".....#.", "#...#..", ".#.#...", "..#....", "#######"],
  },
  merged: {
    token: "--sc-merged",
    rows: [".......", "##.....", "..#....", "...####", "..#....", "##.....", "......."],
  },
  "long-haul": {
    token: "--sc-living",
    rows: [".......", ".......", "##...##", "#######", "##...##", ".......", "......."],
  },
};

const SIDE = 7;

/** One unit square per filled block. */
const pathOf = (rows: readonly string[]): string =>
  rows
    .flatMap((row, y) =>
      [...row].flatMap((block, x) => (block === "#" ? [`M${x} ${y}h1v1h-1z`] : [])),
    )
    .join("");

const PATHS = Object.fromEntries(
  Object.entries(GLYPHS).map(([mark, glyph]) => [mark, pathOf(glyph.rows)]),
) as Readonly<Record<MarkId, string>>;

export function MarkGlyph(props: { readonly mark: MarkId; readonly className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIDE} ${SIDE}`}
      className={props.className}
      style={{ color: `var(${GLYPHS[props.mark].token})` }}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={PATHS[props.mark]} />
    </svg>
  );
}
