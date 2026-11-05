import { rgbCss, type FieldColors, type Rgb } from "./fieldColors";
import type { FieldLayout } from "./field";
import { cellShape, FieldMotion, type FieldFocus } from "./fieldMotion";

// Draws a field on one canvas, and draws nothing at all while nothing moves: a frame is asked for
// only while a cell is landing or easing (`fieldMotion.ts`).

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export class FieldPainter {
  private readonly context: CanvasRenderingContext2D | null;
  private frame = 0;
  private readonly motion = new FieldMotion(prefersReducedMotion());

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
    const { layout } = input;
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
    this.motion.update(input, performance.now());
    this.request();
  }

  setFocus(focus: FieldFocus | null) {
    this.motion.setFocus(focus);
    this.request();
  }

  setHollow(cells: ReadonlySet<number>, tone: Rgb) {
    this.motion.setHollow(cells, tone);
    this.request();
  }

  /** How many cells, from the drive's end, the warning line stands around; 0 hides it. */
  setWarn(cells: number, tone: Rgb) {
    this.motion.setWarn(cells, tone);
    this.request();
  }

  setPointer(pointer: { readonly col: number; readonly row: number } | null) {
    this.motion.setPointer(pointer);
    this.request();
  }

  /** The cell under a point in CSS pixels, or null off the field. */
  cellAt(x: number, y: number) {
    return this.motion.cellAt(x, y);
  }

  private request() {
    if (this.frame === 0) this.frame = requestAnimationFrame((now) => this.draw(now));
  }

  private draw(now: number) {
    this.frame = 0;
    const { context, motion } = this;
    const { layout } = motion;
    if (context === null || layout === null) return;
    const { pitch } = layout;
    const { gap, size, radius } = cellShape(pitch);
    context.clearRect(0, 0, layout.cols * pitch, layout.rows * pitch);
    const busy = motion.frame(now, (look) => {
      const drawn = size * look.scale;
      const inset = (size - drawn) / 2;
      context.beginPath();
      context.roundRect(
        look.col * pitch + gap / 2 + inset,
        look.row * pitch + gap / 2 + inset,
        drawn,
        drawn,
        radius * look.scale,
      );
      if (look.hollow) {
        context.fillStyle = rgbCss(motion.hollowTone, 0.14);
        context.fill();
        context.lineWidth = 1.2;
        context.strokeStyle = rgbCss(motion.hollowTone, 0.95);
        context.stroke();
        return;
      }
      context.fillStyle = rgbCss(look.fill);
      context.fill();
      if (look.warned) {
        context.lineWidth = 1.2;
        context.strokeStyle = rgbCss(motion.warnTone);
        context.stroke();
      }
    });
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
