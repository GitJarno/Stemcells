// A scene on Aski's stage, as the page plays it: the canvas over the stage,
// the worker that draws into it, and the few moments the page itself acts
// at. A due scene is played once the stage is in sight; a
// playing one fades the stage away under its canvas, says its line at its
// moment, and fades the stage back as it ends. The page's code runs at those
// moments alone: the worker draws every frame.

import { BODY_HEIGHT } from "../canon.ts";
import { BODY_WIDTH, CELL_ASPECT, homeFit } from "../scene.ts";
import { reducedMotion, timed } from "../../tokens/motion.ts";
import { channels, inkOf } from "./colour.ts";
import { type ScenePart, type SceneShown, sceneLine, sceneNext, sceneShown } from "./scene.ts";
import type { SceneOrder } from "./scene.worker.ts";
import type { Metrics } from "./stage.ts";

/**
 * A scene's cell, in device pixels across, so every dot of Aski's font is a
 * whole pixel. Theater: hand-set for the scenes.
 */
const SCENE_CELL = 8;
/** No stage is this many rows tall. */
const MAX_ROWS = 400;

export interface StageSceneOptions {
  /** The screen's clock, in milliseconds. */
  readonly now: () => number;
  /** A due scene is shown to someone: play it (`aski.play`). */
  readonly play: (scene: string) => void;
  /** The line the stage says over the scene, or none. */
  readonly say: (line: string | undefined) => void;
}

/** The scene's grid on this stage, and where its canvas stands, in CSS pixels from the theater's corner. */
interface Placed {
  readonly cols: number;
  readonly rows: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The grid whose resting cloud is as tall as Aski's figure, on the figure's
 * ground line: the figure fits Aski's ink box into its square, and the
 * grid's own fit stands the cloud on a stage of these rows.
 */
function place(m: Metrics, dpr: number): Placed {
  const cw = SCENE_CELL / dpr;
  const ch = cw / CELL_ASPECT;
  const cols = Math.max(1, Math.floor(m.width / cw));
  const ink = (BODY_HEIGHT * m.aski) / Math.max(BODY_WIDTH, BODY_HEIGHT);
  const tall = (rows: number): number => BODY_HEIGHT * homeFit({ cols, rows }).ky * ch;
  // The most rows whose cloud stands no taller than the figure, or one more when that is nearer; a narrow stage stops growing it.
  let rows = 1;
  while (rows < MAX_ROWS && tall(rows + 1) <= ink && tall(rows + 1) > tall(rows)) rows++;
  if (rows < MAX_ROWS && tall(rows + 1) > tall(rows) && tall(rows + 1) - ink < ink - tall(rows))
    rows++;
  const ground = homeFit({ cols, rows }).ground * ch;
  return {
    cols,
    rows,
    x: (m.width - cols * cw) / 2,
    y: m.aski - ground,
    width: cols * cw,
    height: rows * ch,
  };
}

export class StageScene {
  readonly #canvas: HTMLCanvasElement;
  readonly #theater: HTMLElement;
  readonly #options: StageSceneOptions;
  #worker: Worker | undefined;
  /** Set once no worker can draw here: scenes are not shown. */
  #alone = false;
  #part: ScenePart | undefined;
  #placed: Placed | undefined;
  #inSight = false;
  /** The scene the worker draws: its id, seed and start, and the grid it draws on. */
  #drawing = "";
  /** Plays already sent, so a part is played once. */
  readonly #played = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #clearing: ReturnType<typeof setTimeout> | undefined;

  constructor(canvas: HTMLCanvasElement, theater: HTMLElement, options: StageSceneOptions) {
    this.#canvas = canvas;
    this.#theater = theater;
    this.#options = options;
  }

  /** The stage's size: the scene's grid and its canvas follow it. */
  size(m: Metrics): void {
    const placed = place(m, devicePixelRatio);
    this.#placed = placed;
    Object.assign(this.#canvas.style, {
      width: `${placed.width}px`,
      height: `${placed.height}px`,
      transform: `translate(${placed.x}px, ${placed.y}px)`,
    });
    this.#update();
  }

  /** Core's scene part as it stands. */
  part(part: ScenePart | undefined): void {
    this.#part = part;
    this.#update();
  }

  /** Whether the stage is in sight: a scene plays and draws only then. */
  run(inSight: boolean): void {
    if (inSight === this.#inSight) return;
    this.#inSight = inSight;
    this.#post({ kind: "run", running: inSight });
    this.#update();
  }

  close(): void {
    clearTimeout(this.#timer);
    clearTimeout(this.#clearing);
    this.#worker?.terminate();
    this.#worker = undefined;
  }

  #update(): void {
    clearTimeout(this.#timer);
    const shown = sceneShown(this.#part, this.#options.now());
    if (shown.kind === "due") {
      const key = `${shown.id}/${shown.seed}`;
      if (this.#inSight && !this.#played.has(key)) {
        this.#played.add(key);
        this.#options.play(shown.id);
      }
    }
    if (shown.kind !== "playing" || this.#placed === undefined || !this.#ready()) {
      this.#end();
      return;
    }
    this.#start(shown, this.#placed);
    this.#options.say(sceneLine(shown));
    const next = sceneNext(shown);
    if (next !== undefined)
      this.#timer = setTimeout(() => this.#update(), Math.max(1, next - this.#options.now()));
  }

  #start(shown: Extract<SceneShown, { kind: "playing" }>, placed: Placed): void {
    const key = `${shown.id}/${shown.seed}/${shown.startedAt}/${placed.cols}x${placed.rows}`;
    clearTimeout(this.#clearing);
    this.#theater.dataset.scene = shown.id;
    if (key === this.#drawing) return;
    this.#drawing = key;
    const warm = channels(getComputedStyle(this.#canvas).getPropertyValue("--sc-living")).rgb;
    this.#post({
      kind: "play",
      id: shown.id,
      seed: shown.seed,
      startedAt: shown.startedAt,
      cols: placed.cols,
      rows: placed.rows,
      cell: SCENE_CELL,
      ink: inkOf(this.#canvas),
      warm,
      still: reducedMotion(),
      running: this.#inSight,
    });
  }

  /** The stage comes back; the scene's last frame fades under it, then the canvas is cleared. */
  #end(): void {
    this.#options.say(undefined);
    if (this.#theater.dataset.scene === undefined) return;
    this.#drawing = "";
    delete this.#theater.dataset.scene;
    clearTimeout(this.#clearing);
    this.#clearing = setTimeout(() => this.#post({ kind: "stop" }), timed("fade").duration);
  }

  /** Whether a worker draws here, made with the canvas handed to it on the first scene. */
  #ready(): boolean {
    if (this.#alone) return false;
    if (this.#worker !== undefined) return true;
    try {
      const offscreen = this.#canvas.transferControlToOffscreen();
      const worker = new Worker(new URL("./scene.worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("error", () => {
        this.#alone = true;
        this.#worker = undefined;
        this.#end();
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
