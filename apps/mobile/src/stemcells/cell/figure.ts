// A Cell's frame as the phone draws it: its hero detail (two cells to a cell
// of the miniature) as one SVG path per colour, in units of a detail cell,
// so one drawing serves every size. The web rasters the same rows to a
// canvas (`apps/web/src/stemcells/cell/paint.ts`).

import { keylined, type Ground, type MiniFrame, paletteOf } from "./kit";

/** One colour of a frame: its fill, its alpha, and the cells it covers. */
export interface Ink {
  readonly fill: string;
  readonly opacity: number;
  readonly d: string;
}

export interface Drawing {
  /** Detail cells across and down: the box and its margin. */
  readonly width: number;
  readonly height: number;
  readonly inks: readonly Ink[];
}

/**
 * How far each run reaches past its cells, in detail cells. Colours meet on
 * fractions of a device pixel wherever a figure lands, and each edge's
 * antialiasing would leave a hairline of the ground between them.
 */
const BLEED = 0.04;

/** `#rrggbb` or `#rrggbbaa` as a fill and its alpha. */
function inkOf(hex: string): { fill: string; opacity: number } {
  return hex.length > 7
    ? { fill: hex.slice(0, 7), opacity: Number.parseInt(hex.slice(7, 9), 16) / 255 }
    : { fill: hex, opacity: 1 };
}

const run = (x: number, y: number, width: number): string =>
  `M${x - BLEED} ${y - BLEED}h${width + BLEED * 2}v${1 + BLEED * 2}h${-(width + BLEED * 2)}z`;

/** `rows` of role letters in `body`'s colours: each row's runs of one colour joined, `.` left clear. */
export function drawingOf(rows: readonly string[], body: string): Drawing {
  const palette = paletteOf(body);
  // By colour, not role: roles that share a colour share a path.
  const paths = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = palette[row[x]!];
      if (colour === undefined) continue;
      let end = x;
      while (palette[row[end + 1] ?? "."] === colour) end++;
      paths.set(colour, (paths.get(colour) ?? "") + run(x, y, end - x + 1));
      x = end;
    }
  });
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    inks: [...paths].map(([colour, d]) => ({ ...inkOf(colour), d })),
  };
}

/** Drawings kept, by body, ground and frame; let go together once this many have gathered. */
const KEPT = 512;
const drawings = new Map<string, Drawing>();

/** `frame` drawn in `body`'s colours on `ground`: its pale pieces keylined on the light one, as the web's are. */
export function drawFrame(frame: MiniFrame, body: string, ground: Ground): Drawing {
  const art = frame.drawn.detail;
  const key = `${body}\n${ground}\n${art.join("\n")}`;
  const known = drawings.get(key);
  if (known !== undefined) return known;
  const drawing = drawingOf(ground === "light" ? keylined(art, paletteOf(body)) : art, body);
  if (drawings.size >= KEPT) drawings.clear();
  drawings.set(key, drawing);
  return drawing;
}
