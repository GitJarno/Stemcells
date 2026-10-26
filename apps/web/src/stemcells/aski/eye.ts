// The eye is a block cursor, the █ of SC█: an upright box with squared ends, a terminal cell
// across and a line down. It is drawn as Aski's own outline, not taken from a typeface, so it
// is identical on every machine; the phone and the Watch wear it as drawn here.

import { sdPolygon } from "./math.ts";

/** How wide the block is for a height of one: a terminal's block, a cell across and a line down. */
export const BLOCK_WIDTH = 0.55;

/** The outline, one unit tall, centred on its ink box. */
export const BLOCK: Float64Array = Float64Array.from([
  -BLOCK_WIDTH / 2,
  -0.5,
  BLOCK_WIDTH / 2,
  -0.5,
  BLOCK_WIDTH / 2,
  0.5,
  -BLOCK_WIDTH / 2,
  0.5,
]);

export interface EyePose {
  /** Ink centre in canon units. */
  readonly x: number;
  readonly y: number;
  readonly height: number;
  /** 1 open, toward 0 closed (a blink squashes the block toward a sliver, it never hides it). */
  readonly open: number;
  /** Radians: how far an act sways the block off upright. */
  readonly rot: number;
  /** Facing, -1..1: the block narrows through Aski's turn and is itself again facing either way. */
  readonly facing: number;
  /** A character typed into the eye in place of the block (a mood), drawn by `GLYPHS`; a character it lacks draws the block. */
  readonly glyph?: string | undefined;
}

/** How thick a typed character's strokes are in an eye one unit tall: a bold terminal face's. */
const STROKE = 0.2;

/** A stroke through `points` (x, y pairs), its ends cut square and its corners mitred, as a closed outline. */
function stroke(...points: number[]): Float64Array {
  const n = points.length / 2;
  const at = (i: number): [number, number] => [points[2 * i]!, points[2 * i + 1]!];
  const normal = (i: number): [number, number] => {
    const [ax, ay] = at(i),
      [bx, by] = at(i + 1),
      length = Math.hypot(bx - ax, by - ay);
    return [-(by - ay) / length, (bx - ax) / length];
  };
  const left: number[] = [],
    right: number[] = [];
  for (let i = 0; i < n; i++) {
    const before = i > 0 ? normal(i - 1) : normal(i),
      after = i < n - 1 ? normal(i) : normal(i - 1);
    const mx = before[0] + after[0],
      my = before[1] + after[1],
      length = Math.hypot(mx, my);
    // The mitre: along the corner's bisector, long enough that both edges stay STROKE apart.
    const reach = STROKE / 2 / ((mx / length) * before[0] + (my / length) * before[1]);
    const [x, y] = at(i);
    left.push(x + (mx / length) * reach, y + (my / length) * reach);
    // The far side runs back, so the outline closes on itself.
    right.unshift(x - (mx / length) * reach, y - (my / length) * reach);
  }
  return Float64Array.from([...left, ...right]);
}

/** A square dot, a little heavier than a stroke, its foot on the eye's. */
const dot = (): Float64Array => {
  const half = STROKE * 0.55;
  return Float64Array.from([-half, 0.5 - 2 * half, half, 0.5 - 2 * half, half, 0.5, -half, 0.5]);
};

/** Outlines moved sideways so their ink sits centred across the eye; how high each one sits is its own. */
function centred(...outlines: Float64Array[]): readonly Float64Array[] {
  let x0 = Infinity,
    x1 = -Infinity;
  for (const o of outlines)
    for (let i = 0; i < o.length; i += 2) {
      x0 = Math.min(x0, o[i]!);
      x1 = Math.max(x1, o[i]!);
    }
  const shift = (x0 + x1) / 2;
  return outlines.map((o) => o.map((v, i) => (i % 2 ? v : v - shift)));
}

const a = STROKE / 2;

/**
 * The characters Aski types into its eyes, each an eye one unit tall and centred on it, in strokes as square
 * as the block's: drawn here, not taken from a typeface, so they read the same on every machine.
 */
export const GLYPHS: Readonly<Record<string, readonly Float64Array[]>> = {
  "^": centred(stroke(-0.3, 0.1, 0, -0.26, 0.3, 0.1)),
  "-": centred(stroke(-0.3, 0, 0.3, 0)),
  "?": centred(
    stroke(
      -0.3 + a,
      -0.2,
      -0.3 + a,
      -0.5 + a,
      0.3 - a,
      -0.5 + a,
      0.3 - a,
      -0.06,
      0,
      -0.06,
      0,
      0.16,
    ),
    dot(),
  ),
  "!": centred(stroke(0, -0.5, 0, 0.16), dot()),
  ">": centred(stroke(-0.2, -0.3, 0.2, 0, -0.2, 0.3)),
  "<": centred(stroke(0.2, -0.3, -0.2, 0, 0.2, 0.3)),
  x: centred(stroke(-0.29, -0.29, 0.29, 0.29), stroke(-0.29, 0.29, 0.29, -0.29)),
};

/** Signed distance from (px, py) to one eye, in canon units. */
export function eyeDistance(px: number, py: number, e: EyePose): number {
  let qx = (px - e.x) / e.height,
    qy = (py - e.y) / e.height;
  const c = Math.cos(e.rot),
    s = Math.sin(e.rot);
  [qx, qy] = [c * qx + s * qy, -s * qx + c * qy];
  const open = Math.max(e.open, 0.07);
  const flip = Math.sign(e.facing || 1) * Math.max(Math.abs(e.facing), 0.08);
  const glyph = e.glyph === undefined ? undefined : GLYPHS[e.glyph];
  qy /= open;
  // A typed character narrows through the turn like the block but never reads backwards.
  qx /= glyph === undefined ? flip : Math.abs(flip);
  let ink = Infinity;
  for (const outline of glyph ?? [BLOCK]) ink = Math.min(ink, sdPolygon(qx, qy, outline));
  // Squashing the mark shrinks distances along that axis; scale back by the tighter one so edges stay crisp.
  return (
    ink * e.height * Math.max(Math.min(open, 1), 0.3) * Math.max(Math.min(Math.abs(flip), 1), 0.3)
  );
}
