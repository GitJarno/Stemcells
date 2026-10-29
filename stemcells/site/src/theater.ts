// What every stage on the page shares: a clock that runs only while its stage
// is in sight, Reduce Motion's stills, and a grid canvas painted the app's way.

import {
  type Grid,
  GridPainter,
  homeFit,
  MOODS,
  type Rgb,
  type SceneCard,
  type Stage,
} from "./app.ts";

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Device pixels a CSS pixel, whole: a grid cell keeps its dots whole only on whole pixels. */
export const density = (): number => Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1)));

export const INK: Rgb = [237, 233, 224];
/** The app's `--sc-living`: a scene's one living thing, the koi. */
export const LIVING: Rgb = [253, 190, 72];

/**
 * Calls `frame(t, dt)` each animation frame while `el` is in sight. `t` counts
 * seconds of play, so a stage out of sight picks up where it left off.
 */
export function playWhileSeen(el: Element, frame: (t: number, dt: number) => void): void {
  let raf = 0,
    last = 0,
    t = 0;
  const tick = (now: number) => {
    const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    frame(t, dt);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting && raf === 0) {
        last = 0;
        raf = requestAnimationFrame(tick);
      } else if (!entry?.isIntersecting && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { rootMargin: "120px" },
  ).observe(el);
}

/** Aski's eyes as a grid painter takes them. */
export type Eyes = Parameters<GridPainter["paint"]>[1];
export type EyeLook = NonNullable<Eyes>;

/** A canvas a grid paints on, a cell 8 device pixels across, as the app's stage paints. */
export class GridView {
  readonly stage: Stage;
  readonly canvas: HTMLCanvasElement;
  readonly #painter: GridPainter;
  readonly #image: ImageData;
  readonly #context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    const d = density(),
      cell = 8;
    this.stage = {
      cols: Math.max(8, Math.floor((width * d) / cell)),
      rows: Math.max(4, Math.floor((height * d) / (cell * 2))),
    };
    this.canvas = canvas;
    this.#painter = new GridPainter(this.stage, { cell, ink: INK, warm: LIVING });
    canvas.width = this.#painter.width;
    canvas.height = this.#painter.height;
    canvas.style.width = `${this.#painter.width / d}px`;
    canvas.style.height = `${this.#painter.height / d}px`;
    this.#context = canvas.getContext("2d")!;
    this.#image = new ImageData(
      this.#painter.pixels as Uint8ClampedArray<ArrayBuffer>,
      this.#painter.width,
      this.#painter.height,
    );
  }

  draw(grid: Grid, eyes?: Eyes): void {
    const box = this.#painter.paint(grid, eyes);
    if (box !== undefined)
      this.#context.putImageData(this.#image, 0, 0, box.x, box.y, box.width, box.height);
  }

  /** A scene card at `t`, as the app's stage plays one. */
  drawScene(card: SceneCard, t: number, eyes?: Partial<NonNullable<Eyes>>): void {
    this.draw(card.frame(t, this.stage), eyesOf(card, t, this.stage, eyes));
  }
}

export function eyesOf(
  card: SceneCard,
  t: number,
  stage: Stage,
  over?: Partial<NonNullable<Eyes>>,
): Eyes {
  const mood = card.mood?.(t);
  return {
    open: card.eyes(t),
    fit: homeFit(stage),
    at: card.eyesAt?.(t, stage) ?? null,
    glyphs: mood === undefined ? undefined : MOODS[mood],
    ...over,
  };
}
