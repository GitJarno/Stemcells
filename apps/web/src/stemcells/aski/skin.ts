// Aski's skin of characters, a cell at a time, worked out from its lobes: the character each cell
// of its body wears, right up to the eyes, which are holes in it. The reference renderer draws it
// pixel by pixel (render.ts); Aski's figure wears it at rest, on the Mac (stage/figure.ts) and on
// the phone (`restingInk`), wherever a cell is large enough to read.

import { Aski, type Frame } from "./aski.ts";
import { EYES } from "./canon.ts";
import { BODY_CHARS, FONT_H, FONT_W, glyphBit, RAMP } from "./font.ts";
import { clamp, hash } from "./math.ts";
import { CELL } from "./particles.ts";
import { bodyDistance, limbChar, sceneDistance } from "./sdf.ts";

/** The seed of Aski at rest; a resting frame needs only one. */
const SEED = 1;
/** How wide a cell must be, in device pixels, for its character to read: the font's 5 dots and their margin. */
const READS_FROM = 6;
/** How tall an eye must be, in device pixels, to read a character typed into it; a smaller one keeps its block. */
const TYPED_FROM = 8;
const EYE_MID_X = (EYES.centers[0][0] + EYES.centers[1][0]) / 2,
  EYE_MID_Y = (EYES.centers[0][1] + EYES.centers[1][1]) / 2;

/** A cell is this many dots across and down: the font's 5×7, and a margin round it. */
const DOTS = { across: FONT_W + 3, down: FONT_H + 1 } as const;
/** Where the font's first dot sits in its cell, in dots from the cell's left and top. */
const MARGIN = { left: 1.5, top: 0.5 } as const;
/** A dot's side, canon units. */
export const DOT = CELL / DOTS.across;

/** A cell's body ink: one the skin has yet to reach. */
export const SOLID = "solid";

/** A cell of the skin: its character and how strongly it is inked. */
interface Mark {
  readonly ch: string;
  readonly ink: number;
}

/** Aski standing at rest, as its figure draws it. */
export const atRest = (): Frame => new Aski({ seed: SEED, cues: [] }).frameAt(0);

/** The frame wearing its skin all over. */
export const inSkin = (f: Frame): Frame => ({ ...f, controls: { ...f.controls, live: 1 } });

/** Whether Aski drawn `scale` device pixels to the canon unit wears its skin; smaller, it is solid ink. */
export const wearsSkin = (scale: number): boolean => CELL * scale >= READS_FROM;

/** Whether eyes drawn `scale` device pixels to the canon unit read a character typed into them. */
export const eyesType = (scale: number): boolean => EYES.height * scale >= TYPED_FROM;

/** The glyph's ink at (fx, fy) inside its cell, both 0..1. */
export function glyphAt(ch: string, fx: number, fy: number): number {
  return glyphBit(
    ch,
    Math.floor(fx * DOTS.across - MARGIN.left),
    Math.floor(fy * DOTS.down - MARGIN.top),
  );
}

/**
 * What cell (`gx`, `gy`) of the live skin wears: a character, nothing (null), or the body's ink
 * (`SOLID`). Cells switch on outward from the eyes; limbs draw in line characters.
 */
export function skinCell(f: Frame, gx: number, gy: number): Mark | typeof SOLID | null {
  const c = f.controls,
    ccx = (gx + 0.5) * CELL,
    ccy = (gy + 0.5) * CELL,
    h = hash(f.seed, gx, gy, 5);
  const val = c.live * 1.6 - Math.hypot(ccx - EYE_MID_X, ccy - EYE_MID_Y) / 240 - h * 0.35;
  if (val <= 0) return SOLID;
  const limb = limbChar(f, ccx, ccy);
  if (limb.d < CELL * 0.55 && limb.d < bodyDistance(f, ccx, ccy)) return { ch: limb.ch, ink: 1 };
  const cov = clamp(0.5 - (sceneDistance(f, ccx, ccy) / CELL) * 1.1, 0, 1);
  if (cov < 0.03) return null;
  const front = clamp(val / 0.3, 0, 1);
  const roll = Math.floor(f.t * (front < 1 ? 20 : 1.5) + h * 10);
  const ch =
    cov < 0.9
      ? RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(cov * (RAMP.length - 1)))]!
      : BODY_CHARS[Math.floor(hash(f.seed, gx, gy, roll) * BODY_CHARS.length)]!;
  return { ch, ink: 0.55 + 0.45 * front };
}

let ink: readonly (readonly [number, number, number, number])[] | undefined;

/**
 * Aski's skin at rest as rectangles of ink, each x, y, width and height in dots (`DOT`) from the
 * ground point: a character's dots in runs along its rows, a solid cell whole.
 */
export function restingInk(): readonly (readonly [number, number, number, number])[] {
  if (ink !== undefined) return ink;
  const f = inSkin(atRest());
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (let i = 0; i < f.lobes.length; i += 3) {
    const r = f.lobes[i + 2]! + CELL;
    x0 = Math.min(x0, f.lobes[i]! - r);
    x1 = Math.max(x1, f.lobes[i]! + r);
    y0 = Math.min(y0, f.lobes[i + 1]! - r);
    y1 = Math.max(y1, f.lobes[i + 1]! + r);
  }
  const out: (readonly [number, number, number, number])[] = [];
  for (let gy = Math.floor(y0 / CELL); gy <= Math.floor(y1 / CELL); gy++) {
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
      const cell = skinCell(f, gx, gy);
      if (cell === null) continue;
      const x = gx * DOTS.across,
        y = gy * DOTS.down;
      if (cell === SOLID) {
        out.push([x, y, DOTS.across, DOTS.down]);
        continue;
      }
      for (let row = 0; row < FONT_H; row++) {
        for (let col = 0; col < FONT_W; col++) {
          if (!glyphBit(cell.ch, col, row) || glyphBit(cell.ch, col - 1, row)) continue;
          let end = col + 1;
          while (glyphBit(cell.ch, end, row)) end++;
          out.push([x + col + MARGIN.left, y + row + MARGIN.top, end - col, 1]);
        }
      }
    }
  }
  return (ink = out);
}
