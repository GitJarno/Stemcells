import { bandColor, mixRgb, type FieldColors, type Rgb } from "./fieldColors";
import type { FieldLayout } from "./field";

// What each cell of a field shows at a moment, for any surface to draw: a canvas on the web, an
// SVG on the phone. Every cell lands as the brand's Cells do: it shuffles through the drive's
// colours on a stepped clock, then locks with a flash. Once nothing moves, no frame is wanted.

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

/** One cell as it stands now. */
export interface CellLook {
  readonly col: number;
  readonly row: number;
  /** Against its size at rest. */
  readonly scale: number;
  readonly fill: Rgb;
  /** What would come back: drawn as an outline in `hollowTone`, not filled. */
  readonly hollow: boolean;
  /** Inside the warning line: outlined in `warnTone`. */
  readonly warned: boolean;
  /** Landing, easing or lifting: its colour is between two. */
  readonly moving: boolean;
}

/** A cell's square inside its pitch, and its corners. */
export function cellShape(pitch: number) {
  const gap = Math.max(1.5, pitch * 0.15);
  const size = pitch - gap;
  return { gap, size, radius: Math.min(3.2, size * 0.24) };
}

export function cellColor(colors: FieldColors, tone: Rgb, layout: FieldLayout, cell: number): Rgb {
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

export class FieldMotion {
  layout: FieldLayout | null = null;
  colors: FieldColors | null = null;
  hollowTone: Rgb = [0, 0, 0];
  warnTone: Rgb = [0, 0, 0];
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
  private pointer: { readonly col: number; readonly row: number } | null = null;

  constructor(private readonly reduced: boolean) {}

  /**
   * New figures. `entrance` runs the whole wave; otherwise only cells whose colour changed land.
   * Whether any cell will look different.
   */
  update(
    input: {
      readonly layout: FieldLayout;
      readonly colors: FieldColors;
      readonly tone: Rgb;
      readonly entrance: boolean;
    },
    now: number,
  ): boolean {
    const { layout, colors, tone, entrance } = input;
    const previous = this.layout;
    const sameShape =
      previous !== null && previous.cells === layout.cells && previous.rows === layout.rows;
    const target = Array.from({ length: layout.cells }, (_, cell) =>
      cellColor(colors, tone, layout, cell),
    );
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
    }
    let changed = entrance || !sameShape;
    if (!changed) {
      for (let cell = 0; cell < layout.cells; cell += 1) {
        const before = this.target[cell];
        const after = target[cell];
        if (before === undefined || after === undefined) continue;
        const differs = before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2];
        if (!differs) continue;
        changed = true;
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
    const hues = layout.bands
      .filter((band) => band.kind !== "system" && band.kind !== "free" && band.count > 0)
      .map((band) => bandColor(colors, band));
    this.shufflePalette = [...hues, tone];
    return changed;
  }

  setFocus(focus: FieldFocus | null) {
    this.focus = focus;
  }

  setHollow(cells: ReadonlySet<number>, tone: Rgb) {
    this.hollow = cells;
    this.hollowTone = tone;
  }

  /** How many cells, from the drive's end, the warning line stands around; 0 hides it. */
  setWarn(cells: number, tone: Rgb) {
    this.warnCells = cells;
    this.warnTone = tone;
  }

  setPointer(pointer: { readonly col: number; readonly row: number } | null) {
    this.pointer = this.reduced ? null : pointer;
  }

  /** The cell under a point, in the layout's units, or null off the field. */
  cellAt(x: number, y: number) {
    const layout = this.layout;
    if (layout === null) return null;
    const col = Math.floor(x / layout.pitch);
    const row = Math.floor(y / layout.pitch);
    if (col < 0 || row < 0 || col >= layout.cols || row >= layout.rows) return null;
    return { cell: col * layout.rows + row, col, row };
  }

  /** Hands every cell's look at `now` to `draw`, in order: whether any is still moving. */
  frame(now: number, draw: (look: CellLook) => void): boolean {
    const { layout, colors } = this;
    if (layout === null || colors === null) return false;
    const { rows, cells } = layout;
    let busy = false;
    const step = Math.floor(now / STEP_MS);
    const firstWarned = cells - this.warnCells;
    const focus = this.focus;

    for (let cell = 0; cell < cells; cell += 1) {
      const col = Math.floor(cell / rows);
      const row = cell % rows;
      const target = this.target[cell] ?? colors.socket;
      let rgb = this.shown[cell] ?? target;
      let scale = 1;
      let moving = false;

      const lockAt = this.lockAt[cell] ?? 0;
      if (lockAt !== 0) {
        busy = true;
        moving = true;
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
      if (!settled) {
        busy = true;
        moving = true;
      }

      const pointer = this.pointer;
      const reach =
        pointer === null
          ? 0
          : Math.max(0, 1 - Math.hypot(col - pointer.col, row - pointer.row) / 2.6);
      const lifted = this.lifted[cell] ?? 0;
      const raised = lifted + (reach - lifted) * 0.3;
      const rested = Math.abs(raised - reach) < 0.004;
      this.lifted[cell] = rested ? reach : raised;
      if (!rested) {
        busy = true;
        moving = true;
      }
      scale += (this.lifted[cell] ?? 0) * 0.1;

      draw({
        col,
        row,
        scale,
        fill: mixRgb(colors.socket, rgb, this.emphasis[cell] ?? 1),
        hollow: this.hollow.has(cell),
        warned: cell >= firstWarned,
        moving,
      });
    }
    return busy;
  }
}
