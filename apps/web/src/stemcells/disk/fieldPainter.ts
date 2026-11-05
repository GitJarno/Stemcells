import { bandColor, mixRgb, rgbCss, type FieldColors, type Rgb } from "./fieldColors";
import type { FieldLayout } from "./field";

// Draws a field on one canvas, and draws nothing at all while nothing moves: a frame is asked for
// only while a cell is landing or easing. Every cell lands as the brand's Cells do: it shuffles
// through the drive's colours on a stepped clock, then locks with a flash.

const WAVE_MS = 820;
const SHUFFLE_MS = 230;
const LAND_MS = 190;
const STEP_MS = 62;
const SCATTER_MS = 90;
const RECEDED = 0.17;
const OTHER_ITEMS = 0.5;

/** Stable noise, so a cell's shuffle doesn't change from one frame to the next within a step. */
const noise = (cell: number, salt: number) => {
  let value = Math.imul(cell, 73856093) ^ Math.imul(salt, 19349663);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
};

export interface FieldFocus {
  readonly band: number;
  readonly item: number | null;
}

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function cellColor(colors: FieldColors, tone: Rgb, layout: FieldLayout, cell: number): Rgb {
  const band = layout.bands[layout.bandOf[cell] ?? 0];
  if (band === undefined) return colors.socket;
  if (band.kind === "free") return tone;
  if (band.kind === "system") return colors.system[cell % 2 === 0 ? 0 : 1];
  const base = bandColor(colors, band);
  if (band.items.length === 0) return base;
  // Inside a band its biggest items stand brightest, the rest back: structure without a new hue.
  const item = layout.itemOf[cell] ?? 0;
  if (item >= band.items.length) return mixRgb(base, colors.socket, 0.3);
  const away = colors.dark ? ([255, 255, 255] as const) : ([0, 0, 0] as const);
  return item <= 1
    ? mixRgb(base, away, 0.14 - item * 0.07)
    : mixRgb(base, colors.socket, Math.min(0.22, (item - 1) * 0.07));
}

export class FieldPainter {
  private readonly context: CanvasRenderingContext2D | null;
  private frame = 0;
  private layout: FieldLayout | null = null;
  private colors: FieldColors | null = null;
  private tone: Rgb = [0, 0, 0];
  private shown: Array<Rgb> = [];
  private target: Array<Rgb> = [];
  /** When each cell stops shuffling; 0 once it has landed. */
  private lockAt = new Float64Array(0);
  private emphasis = new Float32Array(0);
  private lifted = new Float32Array(0);
  private shufflePalette: ReadonlyArray<Rgb> = [];
  private focus: FieldFocus | null = null;
  private hollow: ReadonlySet<number> = new Set();
  private warnCells = 0;
  private warnTone: Rgb = [0, 0, 0];
  private pointer: { readonly col: number; readonly row: number } | null = null;
  private readonly reduced = prefersReducedMotion();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.context = canvas.getContext("2d");
  }

  dispose() {
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** New figures. `entrance` runs the whole wave; otherwise only cells whose colour changed land. */
  update(input: {
    readonly layout: FieldLayout;
    readonly colors: FieldColors;
    readonly tone: Rgb;
    readonly entrance: boolean;
  }) {
    const { layout, colors, tone, entrance } = input;
    const previous = this.layout;
    const sameShape =
      previous !== null && previous.cells === layout.cells && previous.rows === layout.rows;
    const ratio = window.devicePixelRatio || 1;
    const width = layout.cols * layout.pitch;
    const height = layout.rows * layout.pitch;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.canvas.style.height = `${height}px`;
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);

    const target = Array.from({ length: layout.cells }, (_, cell) =>
      cellColor(colors, tone, layout, cell),
    );
    const now = performance.now();
    if (!sameShape) {
      this.emphasis = new Float32Array(layout.cells).fill(1);
      this.lifted = new Float32Array(layout.cells);
      this.lockAt = new Float64Array(layout.cells);
    }
    if (entrance || !sameShape) {
      const wave = entrance && !this.reduced;
      for (let cell = 0; cell < layout.cells; cell += 1) {
        const col = Math.floor(cell / layout.rows);
        this.lockAt[cell] = wave
          ? now + SHUFFLE_MS + (col / layout.cols) * WAVE_MS + noise(cell, 1) * SCATTER_MS
          : 0;
      }
      this.shown = wave ? target.map(() => colors.socket) : target;
    } else {
      for (let cell = 0; cell < layout.cells; cell += 1) {
        const before = this.target[cell];
        const after = target[cell];
        if (before === undefined || after === undefined) continue;
        const changed = before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2];
        if (!changed) continue;
        if (this.reduced) {
          this.shown[cell] = after;
          continue;
        }
        const col = Math.floor(cell / layout.rows);
        this.lockAt[cell] = now + SHUFFLE_MS + (col / layout.cols) * (WAVE_MS / 2);
        this.shown[cell] = before;
      }
    }
    this.target = target;
    this.layout = layout;
    this.colors = colors;
    this.tone = tone;
    const hues = layout.bands
      .filter((band) => band.kind !== "system" && band.kind !== "free" && band.count > 0)
      .map((band) => bandColor(colors, band));
    this.shufflePalette = [...hues, tone];
    this.request();
  }

  setFocus(focus: FieldFocus | null) {
    this.focus = focus;
    this.request();
  }

  setHollow(cells: ReadonlySet<number>, tone: Rgb) {
    this.hollow = cells;
    this.tone = tone;
    this.request();
  }

  /** How many cells, from the drive's end, the warning line stands around; 0 hides it. */
  setWarn(cells: number, tone: Rgb) {
    this.warnCells = cells;
    this.warnTone = tone;
    this.request();
  }

  setPointer(pointer: { readonly col: number; readonly row: number } | null) {
    this.pointer = this.reduced ? null : pointer;
    this.request();
  }

  /** The cell under a point in CSS pixels, or null off the field. */
  cellAt(x: number, y: number) {
    const layout = this.layout;
    if (layout === null) return null;
    const col = Math.floor(x / layout.pitch);
    const row = Math.floor(y / layout.pitch);
    if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return null;
    return { cell: col * layout.rows + row, col, row };
  }

  private request() {
    if (this.frame === 0) this.frame = requestAnimationFrame((now) => this.draw(now));
  }

  private draw(now: number) {
    this.frame = 0;
    const { context, layout, colors } = this;
    if (context === null || layout === null || colors === null) return;
    const { pitch, rows, cols, cells } = layout;
    const gap = Math.max(1.5, pitch * 0.15);
    const size = pitch - gap;
    const radius = Math.min(3.2, size * 0.24);
    context.clearRect(0, 0, cols * pitch, rows * pitch);
    let busy = false;
    const step = Math.floor(now / STEP_MS);
    const firstWarned = cells - this.warnCells;
    const focus = this.focus;

    for (let cell = 0; cell < cells; cell += 1) {
      const col = Math.floor(cell / rows);
      const row = cell % rows;
      const x = col * pitch + gap / 2;
      const y = row * pitch + gap / 2;
      const target = this.target[cell] ?? colors.socket;
      let rgb = this.shown[cell] ?? target;
      let scale = 1;

      const lockAt = this.lockAt[cell] ?? 0;
      if (lockAt !== 0) {
        busy = true;
        const left = lockAt - now;
        if (left > SHUFFLE_MS) {
          // Not reached yet: it keeps what it showed.
        } else if (left > 0) {
          const palette = this.shufflePalette;
          const flip = palette[Math.floor(noise(cell, step) * palette.length)] ?? target;
          rgb = mixRgb(flip, colors.socket, 0.25);
          scale = 0.86;
        } else {
          this.shown[cell] = target;
          rgb = target;
          const age = -left;
          if (age < LAND_MS) {
            const glow = (1 - age / LAND_MS) ** 2;
            rgb = mixRgb(target, colors.flash, glow * 0.72);
            scale = 1 + glow * 0.1;
          } else {
            this.lockAt[cell] = 0;
          }
        }
      }

      const inBand = focus !== null && layout.bandOf[cell] === focus.band;
      const wanted =
        focus === null
          ? 1
          : !inBand
            ? RECEDED
            : focus.item !== null && layout.itemOf[cell] !== focus.item
              ? OTHER_ITEMS
              : 1;
      const emphasis = this.emphasis[cell] ?? 1;
      const eased = this.reduced ? wanted : emphasis + (wanted - emphasis) * 0.24;
      const settled = Math.abs(eased - wanted) < 0.004;
      this.emphasis[cell] = settled ? wanted : eased;
      if (!settled) busy = true;

      const pointer = this.pointer;
      const reach =
        pointer === null
          ? 0
          : Math.max(0, 1 - Math.hypot(col - pointer.col, row - pointer.row) / 2.6);
      const lifted = this.lifted[cell] ?? 0;
      const raised = lifted + (reach - lifted) * 0.3;
      const rested = Math.abs(raised - reach) < 0.004;
      this.lifted[cell] = rested ? reach : raised;
      if (!rested) busy = true;
      scale += (this.lifted[cell] ?? 0) * 0.1;

      const drawn = size * scale;
      const inset = (size - drawn) / 2;
      context.beginPath();
      context.roundRect(x + inset, y + inset, drawn, drawn, radius * scale);

      if (this.hollow.has(cell)) {
        context.fillStyle = rgbCss(this.tone, 0.14);
        context.fill();
        context.lineWidth = 1.2;
        context.strokeStyle = rgbCss(this.tone, 0.95);
        context.stroke();
        continue;
      }
      context.fillStyle = rgbCss(mixRgb(colors.socket, rgb, this.emphasis[cell] ?? 1));
      context.fill();
      if (cell >= firstWarned) {
        context.lineWidth = 1.2;
        context.strokeStyle = rgbCss(this.warnTone);
        context.stroke();
      }
    }
    if (busy) this.request();
  }
}

/** A drive at rest in a small canvas: how full, in one grey and the headline's colour. */
export function paintShelfField(
  canvas: HTMLCanvasElement,
  layout: FieldLayout,
  colors: FieldColors,
  tone: Rgb,
) {
  const context = canvas.getContext("2d");
  if (context === null) return;
  const ratio = window.devicePixelRatio || 1;
  const width = layout.cols * layout.pitch;
  const height = layout.rows * layout.pitch;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const gap = Math.max(1, layout.pitch * 0.18);
  const size = layout.pitch - gap;
  const radius = Math.min(1.5, size * 0.25);
  for (let cell = 0; cell < layout.cells; cell += 1) {
    const free = layout.bands[layout.bandOf[cell] ?? 0]?.kind === "free";
    context.fillStyle = rgbCss(free ? tone : colors.system[0]);
    context.beginPath();
    context.roundRect(
      Math.floor(cell / layout.rows) * layout.pitch,
      (cell % layout.rows) * layout.pitch,
      size,
      size,
      radius,
    );
    context.fill();
  }
}
