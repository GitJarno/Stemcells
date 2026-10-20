// When Aski dissolves, its ink becomes characters: one per cell of its resting
// body. Where each one is at any moment is a closed-form function of time and
// seed, so a dissolve can be seeked, reversed and rendered offline exactly.

import { EYES, GOO, LOBES } from "./canon.ts";
import { BLOCK } from "./eye.ts";
import { BODY_CHARS, RAMP } from "./font.ts";
import { clamp, hash, sdPolygon, smin } from "./math.ts";

export const CELL = 10;
const CENTER: readonly [number, number] = [0, -110];
const EYE_MID: readonly [number, number] = [
  (EYES.centers[0][0] + EYES.centers[1][0]) / 2,
  (EYES.centers[0][1] + EYES.centers[1][1]) / 2,
];

export interface Home {
  readonly x: number;
  readonly y: number;
  /** How much of the cell the body covers at rest: edges get the light ramp characters. */
  readonly cov: number;
  readonly i: number;
  /** Distance from the eyes: changes travel outward from them. */
  readonly fromEyes: number;
}

/** Distance to the resting body, canon units: negative inside. Scenes sample the cloud with it too. */
export function restDistance(x: number, y: number): number {
  let d = Infinity;
  for (const l of LOBES)
    d =
      d === Infinity
        ? Math.hypot(x - l.x, y - l.y) - l.r
        : smin(d, Math.hypot(x - l.x, y - l.y) - l.r, GOO.rest);
  return d;
}
function inEye(x: number, y: number): boolean {
  return EYES.centers.some(
    ([ex, ey]) =>
      sdPolygon((x - ex) / EYES.height, (y - ey) / EYES.height, BLOCK) * EYES.height < 7,
  );
}

let homes: Home[] | null = null;
/** The cells of the resting body, in a stable order (row by row). */
export function restHomes(): readonly Home[] {
  if (homes) return homes;
  homes = [];
  for (let y = -240 + CELL / 2; y < 10; y += CELL) {
    for (let x = -140 + CELL / 2; x < 140; x += CELL) {
      const cov = clamp(0.5 - (restDistance(x, y) / CELL) * 1.1, 0, 1);
      if (cov > 0.03 && !inEye(x, y))
        homes.push({
          x,
          y,
          cov,
          i: homes.length,
          fromEyes: Math.hypot(x - EYE_MID[0], y - EYE_MID[1]),
        });
    }
  }
  return homes;
}

/** The character a cell shows: the ramp at the edges, a body character inside. */
export function homeChar(h: Home, seed: number, roll: number): string {
  if (h.cov < 0.9)
    return RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(h.cov * (RAMP.length - 1)))]!;
  return BODY_CHARS[Math.floor(hash(seed, h.i, 31, roll) * BODY_CHARS.length)]!;
}

const OMEGA = 7.5,
  ZETA = 0.42,
  OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);

/**
 * Where a character is `pt` seconds after the burst, body space. It flies out
 * along a damped spring, floats loose as a cloud of characters, and by
 * `settle` = 1 sits exactly on its cell: the ASCII form.
 */
export function particleAt(h: Home, seed: number, pt: number, settle: number): [number, number] {
  let dx = h.x - CENTER[0],
    dy = h.y - CENTER[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const v = 260 + 260 * hash(seed, h.i, 1);
  const k = (Math.exp(-ZETA * OMEGA * pt) * Math.sin(OMEGA_D * pt)) / OMEGA_D;
  const loose = (1 - settle) * Math.min(1, pt / 0.5);
  const fx = Math.sin(1.3 * pt + h.i) * 3 * Math.min(1, pt / 0.6),
    fy = Math.cos(1.1 * pt + 1.7 * h.i) * 3 * Math.min(1, pt / 0.6);
  return [
    CENTER[0] + (h.x - CENTER[0]) * (1 + 0.1 * loose) + (dx * v * k + fx) * (1 - settle),
    CENTER[1] + (h.y - CENTER[1]) * (1 + 0.1 * loose) + ((dy * v - 120) * k + fy) * (1 - settle),
  ];
}

/** While loose, characters churn; once settled they hold still. */
export function particleChar(h: Home, seed: number, pt: number, settle: number): string {
  const roll = settle >= 1 ? 0 : Math.floor(pt * (2 + 4 * hash(seed, h.i, 2)));
  return homeChar(h, seed, roll);
}

/** ASCII filling into pixels, cell by cell, outward from the eyes. */
export const fillOf = (h: Home, seed: number, fill: number): number =>
  clamp((fill * 1.6 - h.fromEyes / 240 - hash(seed, h.i, 3) * 0.3) / 0.25, 0, 1);
