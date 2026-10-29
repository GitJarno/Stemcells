// A stage: Aski's grid painted behind (the app's painter), a canvas in front for
// Cells and the characters that travel between them, both on the same device
// pixels. Characters are drawn in Aski's own font, so one that lands in its skin
// is the same character the painter would draw there, only in a Cell's colour.

import {
  CELL_ASPECT,
  cellToCanon,
  cloudCells,
  EYES,
  type Fit,
  glyphInCell,
  type Grid,
  homeFit,
  makeGrid,
  put,
  type Stage as GridStage,
} from "./app.ts";
import { density, type Eyes, GridView, INK } from "./theater.ts";

/** A grid cell, device pixels: 8 across, as the view paints. */
export const CW = 8,
  CH = Math.round(CW / CELL_ASPECT);

const glyphs = new Map<string, HTMLCanvasElement>();

/** `ch` in Aski's font, `colour`, filling one grid cell. */
export function glyphOf(ch: string, colour: string): HTMLCanvasElement {
  const key = `${ch}${colour}`;
  let canvas = glyphs.get(key);
  if (canvas === undefined) {
    canvas = document.createElement("canvas");
    canvas.width = CW;
    canvas.height = CH;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(CW, CH);
    const [r, g, b] = rgbOf(colour);
    for (let y = 0; y < CH; y++)
      for (let x = 0; x < CW; x++) {
        let cover = 0;
        for (let sy = 0; sy < 2; sy++)
          for (let sx = 0; sx < 2; sx++)
            cover += glyphInCell(ch, (x + 0.25 + sx * 0.5) / CW, (y + 0.25 + sy * 0.5) / CH);
        const o = (y * CW + x) * 4;
        image.data[o] = r;
        image.data[o + 1] = g;
        image.data[o + 2] = b;
        image.data[o + 3] = Math.round((cover / 4) * 255);
      }
    context.putImageData(image, 0, 0);
    glyphs.set(key, canvas);
  }
  return canvas;
}

export function rgbOf(hex: string): [number, number, number] {
  const n = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [n(1), n(3), n(5)];
}

export const INK_HEX = `#${INK.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** A character in flight: from a point to a grid cell, along an arc. */
export interface Flier {
  readonly ch: string;
  readonly colour: string;
  readonly from: readonly [number, number];
  /** The cell it lands in, as an index into the grid. */
  readonly to: number;
  readonly start: number;
  readonly duration: number;
  /** How high its arc lifts, device pixels (negative lifts it up). */
  readonly lift: number;
}

/** A character that has landed in Aski's skin, in a colour that fades to ink. */
interface Tint {
  readonly ch: string;
  readonly colour: string;
  readonly at: number;
}

export class Stage {
  readonly root: HTMLElement;
  readonly back: HTMLCanvasElement;
  readonly front: HTMLCanvasElement;
  view!: GridView;
  context!: CanvasRenderingContext2D;
  fit!: Fit;
  home!: Grid;
  /** The cells of Aski's body at home, as grid indices, and those a character may land in: not under its eyes, which are holes only over something. */
  skin: number[] = [];
  landing: number[] = [];
  width = 0;
  height = 0;
  readonly fliers: Flier[] = [];
  readonly #tints = new Map<number, Tint>();
  /** How long a landed character keeps its Cell's colour, seconds. */
  fade = 2.6;
  onResize: () => void = () => {};

  readonly #fitOf: (stage: GridStage) => Fit;

  /** `fitOf` places Aski on the grid; home, as the app's scenes place it, unless told. */
  constructor(root: HTMLElement, fitOf: (stage: GridStage) => Fit = homeFit) {
    this.root = root;
    this.#fitOf = fitOf;
    this.back = document.createElement("canvas");
    this.front = document.createElement("canvas");
    this.back.className = "back";
    this.front.className = "front";
    this.back.setAttribute("aria-hidden", "true");
    this.front.setAttribute("aria-hidden", "true");
    root.prepend(this.back, this.front);
    this.#size();
    new ResizeObserver(() => {
      if (Math.abs(this.root.clientWidth * density() - this.width) < CW) return;
      this.#size();
      this.onResize();
    }).observe(root);
  }

  #size(): void {
    this.view = new GridView(this.back, this.root.clientWidth, this.root.clientHeight);
    const { cols, rows } = this.view.stage;
    this.width = cols * CW;
    this.height = rows * CH;
    this.front.width = this.width;
    this.front.height = this.height;
    this.front.style.width = this.back.style.width;
    this.front.style.height = this.back.style.height;
    this.context = this.front.getContext("2d")!;
    this.fit = this.#fitOf(this.view.stage);
    this.skin = cloudCells(this.view.stage, this.fit);
    this.landing = this.skin.filter((k) => {
      const [x, y] = cellToCanon(this.fit, k % cols, Math.floor(k / cols));
      return EYES.centers.every(
        ([ex, ey]) => Math.abs(x - ex) > EYES.height * 0.5 || Math.abs(y - ey) > EYES.height * 0.8,
      );
    });
    this.home = this.cloudAt(this.fit);
  }

  /** Aski's cloud placed by `fit`, spelled `aski` in reading order, as `cloudAtRest` spells it. */
  cloudAt(fit: Fit): Grid {
    const { cols } = this.view.stage;
    const grid = makeGrid(this.view.stage);
    cloudCells(this.view.stage, fit).forEach((k, n) =>
      put(grid, k % cols, Math.floor(k / cols), "aski"[n % 4]!, 1),
    );
    return grid;
  }

  /** CSS pixels from the root's corner of device point (x, y). */
  css(x: number, y: number): [number, number] {
    const d = this.width / this.back.clientWidth || 1;
    return [this.back.offsetLeft - this.back.clientWidth / 2 + x / d, this.back.offsetTop + y / d];
  }

  /** Device pixels a CSS pixel on this stage. */
  get d(): number {
    return this.width / (this.back.clientWidth || 1);
  }

  /** The device point of canon (x, y) at home. */
  point(x: number, y: number): [number, number] {
    return [(x * this.fit.kx + this.fit.cx) * CW, (y * this.fit.ky + this.fit.ground) * CH];
  }

  /** The device point at the middle of grid cell `k`. */
  cellPoint(k: number): [number, number] {
    const { cols } = this.view.stage;
    return [((k % cols) + 0.5) * CW, (Math.floor(k / cols) + 0.5) * CH];
  }

  /** The ground line at home, device pixels. */
  get ground(): number {
    return this.fit.ground * CH;
  }

  /** A skin cell to land in, somewhere new each time. */
  anySkin(): number {
    return this.landing[Math.floor(Math.random() * this.landing.length)]!;
  }

  /** Paints `grid` behind, its landed characters lifted out of it, and the eyes over. */
  paint(grid: Grid, eyes: Eyes, now: number): void {
    if (this.#tints.size === 0) return this.view.draw(grid, eyes);
    const shown: Grid = { ...grid, cells: grid.cells.slice() };
    for (const [k, tint] of this.#tints) {
      if (now - tint.at > this.fade) this.#tints.delete(k);
      else shown.cells[k] = { ch: " ", ink: 0 };
    }
    this.view.draw(shown, eyes);
  }

  clear(): void {
    this.context.clearRect(0, 0, this.width, this.height);
  }

  /** Moves the fliers on, lands the ones that arrive, and draws them and the tints. Returns how many landed. */
  drawLetters(now: number, onLand?: (flier: Flier) => void): number {
    let landed = 0;
    for (let n = this.fliers.length - 1; n >= 0; n--) {
      const f = this.fliers[n]!;
      const u = (now - f.start) / f.duration;
      if (u < 0) {
        // Waiting its turn, where it starts.
        this.context.drawImage(
          glyphOf(f.ch, f.colour),
          Math.round(f.from[0] - CW / 2),
          Math.round(f.from[1] - CH / 2),
        );
        continue;
      }
      const [tx, ty] = this.cellPoint(f.to);
      if (u >= 1) {
        this.fliers.splice(n, 1);
        this.#tints.set(f.to, { ch: f.ch, colour: f.colour, at: now });
        landed++;
        onLand?.(f);
        continue;
      }
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
      const x = f.from[0] + (tx - f.from[0]) * e;
      const y = f.from[1] + (ty - f.from[1]) * e + f.lift * Math.sin(Math.PI * u);
      this.context.drawImage(
        glyphOf(f.ch, f.colour),
        Math.round(x - CW / 2),
        Math.round(y - CH / 2),
      );
    }
    for (const [k, tint] of this.#tints) {
      // It keeps its Cell's colour a beat, then settles into ink.
      const u = Math.min(1, Math.max(0, (now - tint.at) / this.fade - 0.35) / 0.65);
      const [x, y] = this.cellPoint(k);
      const left = Math.round(x - CW / 2),
        top = Math.round(y - CH / 2);
      this.context.globalAlpha = 1 - u;
      this.context.drawImage(glyphOf(tint.ch, tint.colour), left, top);
      this.context.globalAlpha = u;
      this.context.drawImage(glyphOf(tint.ch, INK_HEX), left, top);
      this.context.globalAlpha = 1;
    }
    return landed;
  }
}
