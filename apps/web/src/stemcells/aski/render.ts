// The reference renderer: any frame to RGBA pixels, on the CPU, identically on
// every machine. GPU renderers must match it; its output is the golden truth.

import type { Frame } from "./aski.ts";
import { EYES, PALETTE } from "./canon.ts";
import { type EyePose, eyeDistance } from "./eye.ts";
import { FONT_H, FONT_W, glyphBit } from "./font.ts";
import { type Grid, isEmpty } from "./grid.ts";
import { clamp } from "./math.ts";
import { CELL, fillOf, particleAt, particleChar, restHomes } from "./particles.ts";
import { CELL_ASPECT, cellToCanon, type EyePlace, type Fit } from "./scene.ts";
import { eyesDistance, sceneDistance } from "./sdf.ts";
import { glyphAt, skinCell, SOLID } from "./skin.ts";

export interface Camera {
  readonly width: number;
  readonly height: number;
  /** Pixels per canon unit. */
  readonly scale: number;
  /** World x at the horizontal centre of the image. */
  readonly centerX?: number;
  /** Pixel row of the ground. */
  readonly ground: number;
  /** 'sky' paints the backdrop and shadow; 'clear' leaves only ink, with alpha. */
  readonly background?: "sky" | "clear";
  /** False draws the body whole, its eyes left out: the silhouette a page backs the eyes with. */
  readonly eyes?: boolean;
}

export function render(f: Frame, cam: Camera): Uint8ClampedArray {
  const { width: W, height: H, scale: k, ground } = cam,
    cx = cam.centerX ?? 0,
    sky = cam.background !== "clear";
  // Two ink layers: `ink` is cut by the eyes (solid ink, resolving pixels); `marks` (characters,
  // pixels) step aside for them. Either way the eyes always read.
  const ink = new Float32Array(W * H),
    marks = new Float32Array(W * H),
    eye = new Float32Array(W * H);
  const toBodyX = (px: number) => (px + 0.5 - W / 2) / k + cx - f.x;
  const toBodyY = (py: number) => (py + 0.5 - ground) / k;
  const c = f.controls;

  // The region worth sampling: the body, its limbs and its eyes, with room for the AA edge.
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  const grow = (x: number, y: number, r: number) => {
    x0 = Math.min(x0, x - r);
    x1 = Math.max(x1, x + r);
    y0 = Math.min(y0, y - r);
    y1 = Math.max(y1, y + r);
  };
  for (let i = 0; i < f.lobes.length; i += 3)
    grow(f.lobes[i]!, f.lobes[i + 1]!, f.lobes[i + 2]! + f.goo + 4);
  if (f.limbs) {
    for (let i = 0; i < f.limbs.segs.length; i += 5) {
      grow(f.limbs.segs[i]!, f.limbs.segs[i + 1]!, 40);
      grow(f.limbs.segs[i + 2]!, f.limbs.segs[i + 3]!, 40);
    }
  }
  for (const e of f.eyes) grow(e.x, e.y, e.height);
  const pxFrom = (bx: number) => Math.floor((bx + f.x - cx) * k + W / 2),
    pyFrom = (by: number) => Math.floor(by * k + ground);
  const PX0 = clamp(pxFrom(x0), 0, W),
    PX1 = clamp(pxFrom(x1) + 1, 0, W),
    PY0 = clamp(pyFrom(y0), 0, H),
    PY1 = clamp(pyFrom(y1) + 1, 0, H);

  const aa = (d: number) => clamp(0.5 - d * k, 0, 1);
  const resolving = c.particles > 0 && c.resolve > 0;
  const resolveSize = c.resolve < 0.4 ? CELL / 2 : CELL / 4;
  const resolveInk = clamp((c.resolve - 0.8) / 0.2, 0, 1);

  for (let py = PY0; py < PY1; py++) {
    const by = toBodyY(py);
    for (let px = PX0; px < PX1; px++) {
      const bx = toBodyX(px),
        i = py * W + px;
      eye[i] = cam.eyes === false ? 0 : aa(eyesDistance(f, bx, by));
      let a = 0;
      if (c.solid > 0) a = c.solid * aa(sceneDistance(f, bx, by));
      if (resolving) {
        // Pixels resolving into ink: the grid halves, halves again, then melts into the edge.
        const cxl = (Math.floor(bx / resolveSize) + 0.5) * resolveSize,
          cyl = (Math.floor(by / resolveSize) + 0.5) * resolveSize;
        const fx = bx / resolveSize - Math.floor(bx / resolveSize),
          fy = by / resolveSize - Math.floor(by / resolveSize);
        const gap = 0.08 * (1 - c.resolve);
        const cell =
          sceneDistance(f, cxl, cyl) < 0 && fx > gap && fx < 1 - gap && fy > gap && fy < 1 - gap
            ? 1
            : 0;
        a = Math.max(a, (1 - resolveInk) * cell, resolveInk * aa(sceneDistance(f, bx, by)));
      }
      if (c.live > 0) {
        const m = liveCell(f, bx, by);
        if (m >= 0) {
          marks[i] = m;
          a = 0;
        }
      }
      ink[i] = a;
    }
  }

  if (c.particles > 0 && !resolving) stampParticles(f, cam, marks);

  // Compose: eyes are always the opposite of what's under them.
  const out = new Uint8ClampedArray(W * H * 4);
  const [ir, ig, ib] = PALETTE.ink,
    [sr, sg, sb] = PALETTE.sky,
    [mr, mg, mb] = PALETTE.mist;
  const sh = Math.max(0, 1 - f.lift / 260),
    srx = 120 * (0.55 + 0.45 * sh) * (1 + 0.6 * f.melt) * k,
    sry = 13 * (0.4 + 0.6 * sh) * k;
  const shX = W / 2 + (f.x - cx) * k,
    shY = ground + 3 * k;
  for (let i = 0, py = 0; py < H; py++) {
    for (let px = 0; px < W; px++, i++) {
      const b = ink[i]!,
        e = eye[i]!,
        a = Math.max(b + e - 2 * b * e, marks[i]! * (1 - e)),
        o = i * 4;
      if (!sky) {
        out[o] = ir;
        out[o + 1] = ig;
        out[o + 2] = ib;
        out[o + 3] = Math.round(a * 255);
        continue;
      }
      const dx = (px + 0.5 - shX) / srx,
        dy = (py + 0.5 - shY) / sry,
        s = 0.55 * Math.exp(-(dx * dx + dy * dy) * 2.2);
      const r0 = sr + (mr * 0.92 - sr) * s,
        g0 = sg + (mg * 0.92 - sg) * s,
        b0 = sb + (mb * 0.92 - sb) * s;
      out[o] = r0 + (ir - r0) * a;
      out[o + 1] = g0 + (ig - g0) * a;
      out[o + 2] = b0 + (ib - b0) * a;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** The live ASCII skin at (bx, by), by its cell (skin.ts): -1 where still ink. */
function liveCell(f: Frame, bx: number, by: number): number {
  const gx = Math.floor(bx / CELL),
    gy = Math.floor(by / CELL);
  const cell = skinCell(f, gx, gy);
  if (cell === SOLID) return -1;
  return cell === null ? 0 : glyphAt(cell.ch, bx / CELL - gx, by / CELL - gy) * cell.ink;
}

function stampParticles(f: Frame, cam: Camera, ink: Float32Array): void {
  const c = f.controls,
    k = cam.scale,
    W = cam.width,
    H = cam.height,
    cx = cam.centerX ?? 0;
  const half = (CELL * k) / 2;
  for (const h of restHomes()) {
    const [px, py] = particleAt(h, f.seed, c.pt, c.settle);
    const sx = (px + f.x - cx) * k + W / 2,
      sy = py * k + cam.ground;
    const fill = fillOf(h, f.seed, c.fill),
      ch = particleChar(h, f.seed, c.pt, c.settle);
    const X0 = Math.max(0, Math.floor(sx - half)),
      X1 = Math.min(W, Math.ceil(sx + half)),
      Y0 = Math.max(0, Math.floor(sy - half)),
      Y1 = Math.min(H, Math.ceil(sy + half));
    for (let y = Y0; y < Y1; y++) {
      const fy = (y + 0.5 - (sy - half)) / (2 * half);
      for (let x = X0; x < X1; x++) {
        const fx = (x + 0.5 - (sx - half)) / (2 * half);
        if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) continue;
        const g = glyphAt(ch, fx, fy),
          sq = fx > 0.07 && fx < 0.93 && fy > 0.07 && fy < 0.93 ? 1 : 0;
        const v = g * (1 - fill) + sq * fill,
          i = y * W + x;
        if (v > ink[i]!) ink[i] = v;
      }
    }
  }
}

export interface GridLook {
  /** Pixels per cell across; a cell is 1 / CELL_ASPECT times as tall. A multiple of 8 keeps every dot whole. */
  readonly cell: number;
  /** Aski's eyes over the grid: how open, how Aski lies on the grid, and where they are when they are away from home. */
  readonly eyes?: {
    readonly open: number;
    readonly fit: Fit;
    readonly at?: EyePlace | null;
    /** The characters typed into the eyes, left then right, in place of the blocks. */
    readonly glyphs?: readonly [string, string] | undefined;
  };
}

/** The glyph's ink at (fx, fy) inside a grid cell, both 0..1: dots half again as tall as wide, the glyph centred on its line. */
export function glyphInCell(ch: string, fx: number, fy: number): number {
  const dotH = (1.5 * CELL_ASPECT) / (FONT_W + 3),
    top = (1 - FONT_H * dotH) / 2;
  return glyphBit(ch, Math.floor(fx * (FONT_W + 3) - 1.5), Math.floor((fy - top) / dotH));
}

/** Aski's eyes over a grid, in canon units: none while shut; away from home, where the scene says, in cells; a mood typed into them when it gives one. */
export function gridEyes(eyes: GridLook["eyes"]): EyePose[] {
  if (!eyes || !(eyes.open > 0)) return [];
  const { fit, at: away, open, glyphs } = eyes;
  return away
    ? away.at.map(([ci, cj], n) => ({
        x: (ci - fit.cx) / fit.kx,
        y: (cj - fit.ground) / fit.ky,
        height: away.rows / fit.ky,
        open,
        rot: 0,
        facing: 1,
        glyph: glyphs?.[n],
      }))
    : EYES.centers.map(([x, y], n) => ({
        x,
        y,
        height: EYES.height,
        open,
        rot: 0,
        facing: 1,
        glyph: glyphs?.[n],
      }));
}

/**
 * A scene's grid to RGBA pixels: each cell's character in Aski's own font at its
 * ink, on the sky. Aski's eyes are drawn in ink over it, and the cells under them
 * step aside, so the eyes read in every form.
 */
export function renderGrid(
  g: Grid,
  look: GridLook,
): { rgba: Uint8ClampedArray; width: number; height: number } {
  const cw = look.cell,
    chh = Math.round(cw / CELL_ASPECT),
    W = g.cols * cw,
    H = g.rows * chh;
  const marks = new Float32Array(W * H),
    eye = new Float32Array(W * H),
    warm = new Uint8Array(W * H);
  const fit = look.eyes && look.eyes.open > 0 ? look.eyes.fit : null;
  const poses = gridEyes(look.eyes);
  const eyeAt = (x: number, y: number) => Math.min(...poses.map((e) => eyeDistance(x, y, e)));

  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      const c = g.cells[j * g.cols + i]!;
      if (isEmpty(c)) continue;
      if (fit && eyeAt(...cellToCanon(fit, i, j)) < 0.35 / fit.ky) continue;
      for (let py = 0; py < chh; py++) {
        for (let px = 0; px < cw; px++) {
          const n = (j * chh + py) * W + i * cw + px;
          marks[n] = glyphInCell(c.ch, (px + 0.5) / cw, (py + 0.5) / chh) * c.ink;
          if (c.tone === "warm") warm[n] = 1;
        }
      }
    }
  }
  if (fit) {
    const k = fit.kx * cw; // pixels per canon unit, the same down as across
    const toPx = (x: number) => (x * fit.kx + fit.cx) * cw,
      toPy = (y: number) => (y * fit.ky + fit.ground) * chh;
    const reach = Math.max(...poses.map((e) => e.height)) * 0.8;
    const X0 = clamp(Math.floor(toPx(Math.min(...poses.map((e) => e.x)) - reach)), 0, W),
      X1 = clamp(Math.ceil(toPx(Math.max(...poses.map((e) => e.x)) + reach)), 0, W);
    const Y0 = clamp(Math.floor(toPy(Math.min(...poses.map((e) => e.y)) - reach)), 0, H),
      Y1 = clamp(Math.ceil(toPy(Math.max(...poses.map((e) => e.y)) + reach)), 0, H);
    for (let py = Y0; py < Y1; py++) {
      const y = ((py + 0.5) / chh - fit.ground) / fit.ky;
      for (let px = X0; px < X1; px++)
        eye[py * W + px] = clamp(0.5 - eyeAt(((px + 0.5) / cw - fit.cx) / fit.kx, y) * k, 0, 1);
    }
  }

  const rgba = new Uint8ClampedArray(W * H * 4);
  const [sr, sg, sb] = PALETTE.sky;
  for (let n = 0; n < W * H; n++) {
    const e = eye[n]!,
      m = marks[n]! * (1 - e),
      a = Math.max(m, e),
      o = n * 4;
    const [ir, ig, ib] = warm[n] && m > e ? PALETTE.warm : PALETTE.ink; // the eyes are always ink
    rgba[o] = sr + (ir - sr) * a;
    rgba[o + 1] = sg + (ig - sg) * a;
    rgba[o + 2] = sb + (ib - sb) * a;
    rgba[o + 3] = 255;
  }
  return { rgba, width: W, height: H };
}
