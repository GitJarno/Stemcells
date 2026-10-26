// A grid scene painted into one buffer that lasts as long as its stage. Each frame repaints only
// the cells that changed, and the eyes' box when they moved or opened, by render.ts's own rules,
// so it draws what renderGrid draws at a cost that follows what moved, not the stage's size.
// Glyph coverage is worked out once, the eyes' once for as long as they hold still.

import { eyeDistance } from "./eye.ts";
import { BLANK, type Cell, type Grid, isEmpty, type Stage } from "./grid.ts";
import { clamp } from "./math.ts";
import { type GridLook, glyphInCell, gridEyes } from "./render.ts";
import { CELL_ASPECT, cellToCanon } from "./scene.ts";

export type Rgb = readonly [number, number, number];

export interface PaintLook {
  /** Pixels per cell across, as renderGrid takes it. */
  readonly cell: number;
  /** Plain ink, and the warm ink of a scene's one living thing. */
  readonly ink: Rgb;
  readonly warm: Rgb;
}

/** A box of pixels: from (x, y), this wide and tall. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const sameCell = (a: Cell, b: Cell): boolean =>
  a.ch === b.ch && a.ink === b.ink && a.tone === b.tone;

export class GridPainter {
  readonly width: number;
  readonly height: number;
  /** RGBA, straight alpha: the ink where the scene draws, clear elsewhere. */
  readonly pixels: Uint8ClampedArray;
  readonly #stage: Stage;
  readonly #look: PaintLook;
  readonly #cw: number;
  readonly #ch: number;
  #cells: readonly Cell[];
  /** Each glyph's coverage of its cell, pixel by pixel, worked out once. */
  readonly #glyphs = new Map<string, Float32Array>();
  #eyes = "";
  #eyeBox: Box | undefined;
  /** The eyes' coverage of each pixel in their box, NaN until a frame needs it. */
  #eyeCover = new Float32Array(0);

  constructor(stage: Stage, look: PaintLook) {
    this.#stage = stage;
    this.#look = look;
    this.#cw = look.cell;
    this.#ch = Math.round(look.cell / CELL_ASPECT);
    this.width = stage.cols * this.#cw;
    this.height = stage.rows * this.#ch;
    this.pixels = new Uint8ClampedArray(this.width * this.height * 4);
    this.#cells = Array.from({ length: stage.cols * stage.rows }, () => BLANK);
  }

  /** Paints a frame over the last; returns the box it changed, or nothing when the frame draws as the last did. */
  paint(g: Grid, eyes?: GridLook["eyes"]): Box | undefined {
    const { cols, rows } = this.#stage;
    if (g.cols !== cols || g.rows !== rows)
      throw new RangeError("A painter paints the stage it was made for");
    const poses = gridEyes(eyes);
    const fit = poses.length > 0 ? eyes!.fit : null;
    const key = fit === null ? "" : JSON.stringify([poses, fit]);
    const box = fit === null ? undefined : this.#boxOf(poses, fit);

    const dirty = new Uint8Array(cols * rows);
    for (let k = 0; k < dirty.length; k++)
      if (!sameCell(g.cells[k]!, this.#cells[k]!)) dirty[k] = 1;
    if (key !== this.#eyes) {
      for (const b of [this.#eyeBox, box]) if (b !== undefined) this.#mark(dirty, b);
      this.#eyeCover = new Float32Array(box === undefined ? 0 : box.width * box.height).fill(
        Number.NaN,
      );
    }
    this.#cells = g.cells;
    this.#eyes = key;
    this.#eyeBox = box;

    const eyeAt = (x: number, y: number): number => {
      let d = Infinity;
      for (const e of poses) d = Math.min(d, eyeDistance(x, y, e));
      return d;
    };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if (dirty[j * cols + i] === 0) continue;
        const c = g.cells[j * cols + i]!;
        const drawn =
          !isEmpty(c) && !(fit !== null && eyeAt(...cellToCanon(fit, i, j)) < 0.35 / fit.ky);
        this.#paintCell(i, j, drawn ? c : BLANK, fit === null ? undefined : { fit, eyeAt });
        x0 = Math.min(x0, i);
        y0 = Math.min(y0, j);
        x1 = Math.max(x1, i + 1);
        y1 = Math.max(y1, j + 1);
      }
    }
    if (x1 < 0) return undefined;
    return {
      x: x0 * this.#cw,
      y: y0 * this.#ch,
      width: (x1 - x0) * this.#cw,
      height: (y1 - y0) * this.#ch,
    };
  }

  /** The pixels the eyes may cover, as renderGrid bounds them. */
  #boxOf(poses: ReturnType<typeof gridEyes>, fit: NonNullable<GridLook["eyes"]>["fit"]): Box {
    const cw = this.#cw;
    const chh = this.#ch;
    const toPx = (x: number) => (x * fit.kx + fit.cx) * cw;
    const toPy = (y: number) => (y * fit.ky + fit.ground) * chh;
    const reach = Math.max(...poses.map((e) => e.height)) * 0.8;
    const X0 = clamp(Math.floor(toPx(Math.min(...poses.map((e) => e.x)) - reach)), 0, this.width);
    const X1 = clamp(Math.ceil(toPx(Math.max(...poses.map((e) => e.x)) + reach)), 0, this.width);
    const Y0 = clamp(Math.floor(toPy(Math.min(...poses.map((e) => e.y)) - reach)), 0, this.height);
    const Y1 = clamp(Math.ceil(toPy(Math.max(...poses.map((e) => e.y)) + reach)), 0, this.height);
    return { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0 };
  }

  /** Marks every cell a box of pixels touches. */
  #mark(dirty: Uint8Array, b: Box): void {
    const { cols, rows } = this.#stage;
    const i1 = Math.min(cols, Math.ceil((b.x + b.width) / this.#cw));
    const j1 = Math.min(rows, Math.ceil((b.y + b.height) / this.#ch));
    for (let j = Math.floor(b.y / this.#ch); j < j1; j++)
      for (let i = Math.floor(b.x / this.#cw); i < i1; i++) dirty[j * cols + i] = 1;
  }

  /** The glyph's coverage of a cell, as renderGrid samples it: at each pixel's centre. */
  #glyph(ch: string): Float32Array {
    let coverage = this.#glyphs.get(ch);
    if (coverage !== undefined) return coverage;
    const cw = this.#cw;
    const chh = this.#ch;
    coverage = new Float32Array(cw * chh);
    for (let py = 0; py < chh; py++)
      for (let px = 0; px < cw; px++)
        coverage[py * cw + px] = glyphInCell(ch, (px + 0.5) / cw, (py + 0.5) / chh);
    this.#glyphs.set(ch, coverage);
    return coverage;
  }

  #paintCell(
    i: number,
    j: number,
    c: Cell,
    eyes:
      | { fit: NonNullable<GridLook["eyes"]>["fit"]; eyeAt: (x: number, y: number) => number }
      | undefined,
  ): void {
    const cw = this.#cw;
    const chh = this.#ch;
    const pixels = this.pixels;
    const { ink, warm } = this.#look;
    const coverage = isEmpty(c) ? undefined : this.#glyph(c.ch);
    const tone = c.tone === "warm";
    const x0 = i * cw;
    const y0 = j * chh;
    const box = eyes === undefined ? undefined : this.#eyeBox;
    const cover = this.#eyeCover;
    for (let py = 0; py < chh; py++) {
      const Y = y0 + py;
      let o = (Y * this.width + x0) * 4;
      for (let px = 0; px < cw; px++, o += 4) {
        const X = x0 + px;
        const mark = coverage === undefined ? 0 : coverage[py * cw + px]! * c.ink;
        let e = 0;
        if (
          box !== undefined &&
          X >= box.x &&
          X < box.x + box.width &&
          Y >= box.y &&
          Y < box.y + box.height
        ) {
          const k = (Y - box.y) * box.width + (X - box.x);
          e = cover[k]!;
          if (Number.isNaN(e)) {
            const { fit, eyeAt } = eyes!;
            const y = ((Y + 0.5) / chh - fit.ground) / fit.ky;
            e = clamp(0.5 - eyeAt(((X + 0.5) / cw - fit.cx) / fit.kx, y) * fit.kx * cw, 0, 1);
            cover[k] = e;
          }
        }
        const m = mark * (1 - e);
        // The eyes are always plain ink.
        const colour = tone && m > e ? warm : ink;
        pixels[o] = colour[0];
        pixels[o + 1] = colour[1];
        pixels[o + 2] = colour[2];
        pixels[o + 3] = Math.max(m, e) * 255;
      }
    }
  }
}
