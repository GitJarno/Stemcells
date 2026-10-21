// Plays Aski's moments over its figure: a canvas over the theater, placed
// so the moment's cloud stands where the figure stands (the scenes' own
// placing), drawn by the scene worker. While one plays, the figure fades
// away under it; as it ends the figure fades back over its last frame,
// Aski at rest, and the canvas is cleared. The page types the line.

import { reducedMotion, timed } from "../../tokens/motion.ts";
import { channels, inkOf } from "../stage/colour.ts";
import type { SceneOrder } from "../stage/scene.worker.ts";
import { type Placed, place, SCENE_CELL } from "../stage/stage-scene.ts";
import type { SceneArgs } from "../scenes.ts";
import type { MomentArgs } from "./cards.ts";

/** A moment to play: which, from when (Unix milliseconds), with its numbers; or an act, with its words. */
export interface MomentPlay {
  /** A moment's id (`MOMENT_CARDS`) or a scene's (`SCENE_CARDS`). */
  readonly id: string;
  readonly startedAt: number;
  readonly args?: (MomentArgs & SceneArgs) | undefined;
}

/** The theater's width, the side of Aski's square, and how far down the theater the square stands, in CSS pixels. */
export interface MomentMetrics {
  readonly width: number;
  readonly aski: number;
  readonly top: number;
}

export class MomentPlayer {
  readonly #canvas: HTMLCanvasElement;
  readonly #theater: HTMLElement;
  #worker: Worker | undefined;
  /** Set once no worker can draw here: moments are not shown. */
  #alone = false;
  #placed: Placed | undefined;
  #inSight = false;
  #clearing: ReturnType<typeof setTimeout> | undefined;

  constructor(canvas: HTMLCanvasElement, theater: HTMLElement) {
    this.#canvas = canvas;
    this.#theater = theater;
  }

  /** The theater's size: the moment's grid and its canvas follow it, from the next moment on. */
  size(m: MomentMetrics): void {
    const placed = place(m, devicePixelRatio);
    this.#placed = { ...placed, y: placed.y + m.top };
    Object.assign(this.#canvas.style, {
      width: `${placed.width}px`,
      height: `${placed.height}px`,
      transform: `translate(${placed.x}px, ${placed.y + m.top}px)`,
    });
  }

  /** The point (x, y), in CSS pixels from the theater's corner, in the moment's cells (column, row). */
  cellAt(x: number, y: number): readonly [number, number] | undefined {
    const placed = this.#placed;
    if (placed === undefined) return undefined;
    return [
      ((x - placed.x) / placed.width) * placed.cols,
      ((y - placed.y) / placed.height) * placed.rows,
    ];
  }

  /** Whether the theater is in sight: a moment draws only then. */
  run(inSight: boolean): void {
    if (inSight === this.#inSight) return;
    this.#inSight = inSight;
    this.#post({ kind: "run", running: inSight });
  }

  /** Plays a moment from its start; false when it can't be drawn here. */
  play(moment: MomentPlay): boolean {
    const placed = this.#placed;
    if (placed === undefined || !this.#ready()) return false;
    clearTimeout(this.#clearing);
    this.#theater.dataset.moment = moment.id;
    this.#post({
      kind: "play",
      id: moment.id,
      seed: moment.args?.seed ?? 7,
      startedAt: moment.startedAt,
      cols: placed.cols,
      rows: placed.rows,
      cell: SCENE_CELL,
      ink: inkOf(this.#canvas),
      warm: channels(getComputedStyle(this.#canvas).getPropertyValue("--sc-living")).rgb,
      still: reducedMotion(),
      running: this.#inSight,
      args: moment.args,
    });
    return true;
  }

  /** The figure comes back; the moment's last frame fades under it, then the canvas is cleared. */
  stop(): void {
    if (this.#theater.dataset.moment === undefined) return;
    delete this.#theater.dataset.moment;
    clearTimeout(this.#clearing);
    this.#clearing = setTimeout(() => this.#post({ kind: "stop" }), timed("fade").duration);
  }

  close(): void {
    clearTimeout(this.#clearing);
    this.#worker?.terminate();
    this.#worker = undefined;
  }

  /** Whether a worker draws here, made with the canvas handed to it on the first moment. */
  #ready(): boolean {
    if (this.#alone) return false;
    if (this.#worker !== undefined) return true;
    try {
      const offscreen = this.#canvas.transferControlToOffscreen();
      const worker = new Worker(new URL("../stage/scene.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("error", () => {
        this.#alone = true;
        this.#worker = undefined;
        this.stop();
      });
      worker.postMessage({ kind: "canvas", canvas: offscreen } satisfies SceneOrder, [offscreen]);
      this.#worker = worker;
      return true;
    } catch {
      this.#alone = true;
      return false;
    }
  }

  #post(order: SceneOrder): void {
    this.#worker?.postMessage(order);
  }
}
