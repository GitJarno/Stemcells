// The eye is an apostrophe: a round ball and a long thin tail, the way a typeset
// apostrophe sits. The tail sweeps down and to the left to a sharp tip, and its
// inner edge meets the ball in a crisp corner rather than flowing out of it. It is
// drawn here as Aski's own outline, not taken from any typeface, so it is
// identical on every machine.

import { sdPolygon } from "./math.ts";

function flatten(): Float64Array {
  const pts: number[] = [];
  const head = (a: number): [number, number] => [Math.cos(a), Math.sin(a)];
  // The head (a unit circle): from where the tail's inner edge meets it, low and just
  // right of its foot, over the top, to where its outer edge leaves on the right.
  const a0 = (84 * Math.PI) / 180,
    a1 = 2 * Math.PI;
  const ARC = 48,
    EDGE = 24;
  for (let i = 0; i <= ARC; i++) pts.push(...head(a0 + ((a1 - a0) * i) / ARC));
  const cubic = (
    p0: readonly number[],
    c1: readonly number[],
    c2: readonly number[],
    p3: readonly number[],
  ): void => {
    for (let i = 1; i <= EDGE; i++) {
      const t = i / EDGE,
        u = 1 - t;
      pts.push(
        u * u * u * p0[0]! + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t * t * t * p3[0]!,
        u * u * u * p0[1]! + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t * t * t * p3[1]!,
      );
    }
  };
  // The outer edge leaves the head along its tangent and sweeps down to the tip; the
  // inner edge runs back up and meets the head at an angle (not along its tangent),
  // so the tail is thin and the corner where it joins the ball is crisp.
  const outer = head(a1),
    inner = head(a0),
    tip = [-1.05, 3.05];
  cubic(outer, [1.0, 1.05], [0.3, 2.3], tip);
  cubic(tip, [-0.3, 2.4], [0.3, 1.5], inner);
  pts.pop();
  pts.pop(); // the last point closes onto the first
  // Normalise: ink box centred on (0, 0), one unit tall.
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]!);
    x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!);
    y1 = Math.max(y1, pts[i + 1]!);
  }
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    s = 1 / (y1 - y0);
  return Float64Array.from(pts, (v, i) => (i % 2 ? (v - cy) * s : (v - cx) * s));
}

/** The outline, one unit tall, centred on its ink box. */
export const APOSTROPHE: Float64Array = flatten();

export interface EyePose {
  /** Ink centre in canon units. */
  readonly x: number;
  readonly y: number;
  readonly height: number;
  /** 1 open, toward 0 closed (a blink squashes the mark, it never hides it). */
  readonly open: number;
  /** Radians. π turns the closing quote into an opening one. */
  readonly rot: number;
  /** Facing, -1..1: the mark mirrors when Aski faces left and flattens through the turn. */
  readonly facing: number;
}

/** Signed distance from (px, py) to one eye, in canon units. */
export function eyeDistance(px: number, py: number, e: EyePose): number {
  let qx = (px - e.x) / e.height,
    qy = (py - e.y) / e.height;
  const c = Math.cos(e.rot),
    s = Math.sin(e.rot);
  [qx, qy] = [c * qx + s * qy, -s * qx + c * qy];
  const open = Math.max(e.open, 0.07);
  const flip = Math.sign(e.facing || 1) * Math.max(Math.abs(e.facing), 0.08);
  qy /= open;
  qx /= flip;
  // Squashing the mark shrinks distances along that axis; scale back by the tighter one so edges stay crisp.
  return (
    sdPolygon(qx, qy, APOSTROPHE) *
    e.height *
    Math.max(Math.min(open, 1), 0.3) *
    Math.max(Math.min(Math.abs(flip), 1), 0.3)
  );
}
