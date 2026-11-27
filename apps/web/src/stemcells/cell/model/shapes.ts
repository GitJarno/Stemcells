// The Cell's model is a handful of soft shapes. `fieldOf` says how far a point
// is from their surface, which is all the sprite needs to draw them.

export type Vec3 = readonly [number, number, number];

const ELLIPSOID = 0;
const CAPSULE = 1;
const BOX = 2;
const RING = 3;
const ARCH = 4;
const CAP = 5;

/**
 * One shape, every kind in one layout so the march stays fast: `x y z` is its
 * centre (a capsule's start), `a b c` its radii or half sizes (a capsule's
 * end), `r` a radius, `s t` a box's turn about x (sin, cos) or a cap's band.
 */
export interface Shape {
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly r: number;
  readonly s: number;
  readonly t: number;
  readonly tone: number;
}

const shape = (
  kind: number,
  at: Vec3,
  size: Vec3,
  r: number,
  s: number,
  t: number,
  tone: number,
): Shape => ({
  kind,
  x: at[0],
  y: at[1],
  z: at[2],
  a: size[0],
  b: size[1],
  c: size[2],
  r,
  s,
  t,
  tone,
});

export const ellipsoid = (at: Vec3, radii: Vec3, tone: number) =>
  shape(ELLIPSOID, at, radii, 0, 0, 0, tone);

export const capsule = (from: Vec3, to: Vec3, radius: number, tone: number) =>
  shape(CAPSULE, from, to, radius, 0, 0, tone);

/** A rounded box, turned about x by `turn` radians. */
export const box = (at: Vec3, half: Vec3, round: number, tone: number, turn = 0) =>
  shape(BOX, at, half, round, Math.sin(turn), Math.cos(turn), tone);

/** A ring lying flat, round the y axis. */
export const ring = (at: Vec3, radius: number, tube: number, tone: number) =>
  shape(RING, at, [radius, 0, 0], tube, 0, 0, tone);

/** The upper half of a ring standing in the x-y plane, `rx` wide and `ry` tall. */
export const arch = (at: Vec3, rx: number, ry: number, tube: number, tone: number) =>
  shape(ARCH, at, [rx, ry, 0], tube, 0, 0, tone);

/** The part of an ellipsoid between two heights. */
export const cap = (at: Vec3, radii: Vec3, from: number, to: number, tone: number) =>
  shape(CAP, at, radii, 0, from, to, tone);

function ellipsoidAt(p: Shape, x: number, y: number, z: number): number {
  const ax = (x - p.x) / p.a;
  const ay = (y - p.y) / p.b;
  const az = (z - p.z) / p.c;
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const bx = ax / p.a;
  const by = ay / p.b;
  const bz = az / p.c;
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 < 1e-6 ? -Math.min(p.a, p.b, p.c) : (k0 * (k0 - 1)) / k1;
}

function capsuleAt(p: Shape, x: number, y: number, z: number): number {
  const px = x - p.x;
  const py = y - p.y;
  const pz = z - p.z;
  const bx = p.a - p.x;
  const by = p.b - p.y;
  const bz = p.c - p.z;
  const length = bx * bx + by * by + bz * bz;
  const along =
    length > 1e-9 ? Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / length)) : 0;
  const ex = px - bx * along;
  const ey = py - by * along;
  const ez = pz - bz * along;
  return Math.sqrt(ex * ex + ey * ey + ez * ez) - p.r;
}

function boxAt(p: Shape, x: number, y: number, z: number): number {
  const dy = y - p.y;
  const dz = z - p.z;
  const qx = Math.abs(x - p.x) - p.a + p.r;
  const qy = Math.abs(dy * p.t - dz * p.s) - p.b + p.r;
  const qz = Math.abs(dy * p.s + dz * p.t) - p.c + p.r;
  const mx = Math.max(qx, 0);
  const my = Math.max(qy, 0);
  const mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
}

function thingAt(p: Shape, x: number, y: number, z: number): number {
  switch (p.kind) {
    case ELLIPSOID:
      return ellipsoidAt(p, x, y, z);
    case CAPSULE:
      return capsuleAt(p, x, y, z);
    case BOX:
      return boxAt(p, x, y, z);
    case RING: {
      const dx = x - p.x;
      const dz = z - p.z;
      const q = Math.sqrt(dx * dx + dz * dz) - p.a;
      return Math.sqrt(q * q + (y - p.y) * (y - p.y)) - p.r;
    }
    case ARCH: {
      const ax = (x - p.x) / p.a;
      const ay = (y - p.y) / p.b;
      const q = (Math.sqrt(ax * ax + ay * ay) - 1) * Math.min(p.a, p.b);
      return Math.max(Math.sqrt(q * q + (z - p.z) * (z - p.z)) - p.r, p.y - y);
    }
    default:
      return Math.max(ellipsoidAt(p, x, y, z), p.s - y, y - p.t);
  }
}

export interface Scene {
  /** Shapes that melt into one body, `melt` saying how softly. */
  readonly body: readonly Shape[];
  readonly melt: number;
  /** The floor the body sits on, `tuck` saying how softly it tucks under. */
  readonly floor: number;
  readonly tuck: number;
  /** Hard things: the laptop, and what the Cell wears. */
  readonly things: readonly Shape[];
}

/** The scene's distance field: `at` a point, then `tone` for what was nearest there. */
export function fieldOf(scene: Scene) {
  const { body, things, melt, floor, tuck } = scene;
  let tone = 0;
  const at = (x: number, y: number, z: number): number => {
    let d = 1e9;
    for (let i = 0; i < body.length; i++) {
      const p = body[i]!;
      const di = p.kind === ELLIPSOID ? ellipsoidAt(p, x, y, z) : capsuleAt(p, x, y, z);
      const h = Math.max(melt - Math.abs(d - di), 0) / melt;
      d = Math.min(d, di) - h * h * melt * 0.25;
    }
    const under = floor - y;
    const h = Math.max(tuck - Math.abs(d - under), 0) / tuck;
    d = Math.max(d, under) + h * h * tuck * 0.25;
    tone = 0;
    for (let i = 0; i < things.length; i++) {
      const p = things[i]!;
      const di = thingAt(p, x, y, z);
      if (di < d) {
        d = di;
        tone = p.tone;
      }
    }
    return d;
  };
  return { at, tone: () => tone };
}
