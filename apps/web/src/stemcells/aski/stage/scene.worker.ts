// Draws Aski's scenes off the main thread (work that can take more than a
// frame moves to a web worker), into the stage's canvas handed over once.
// Each frame is the scene at the moment the clock says, painted where it
// changed (GridPainter), at the rate the worker's animation frames come;
// under Reduce Motion the scene's still is painted once. Nothing runs while
// no scene plays or the stage is out of sight.

import { type Box, GridPainter, type Rgb } from "../paint.ts";
import type { SceneCard } from "../scene.ts";
import { homeFit } from "../scene.ts";
import { SCENE_CARDS } from "../scenes.ts";

/** What the page tells the worker. */
export type SceneOrder =
  | { readonly kind: "canvas"; readonly canvas: OffscreenCanvas }
  | {
      readonly kind: "play";
      readonly id: string;
      readonly seed: number;
      /** When the scene started, on the clock `Date.now()` reads. */
      readonly startedAt: number;
      /** The stage in cells, and a cell's width in device pixels. */
      readonly cols: number;
      readonly rows: number;
      readonly cell: number;
      readonly ink: Rgb;
      readonly warm: Rgb;
      /** Reduce Motion: the still alone. */
      readonly still: boolean;
      /** Whether the stage is in sight. */
      readonly running: boolean;
    }
  | { readonly kind: "run"; readonly running: boolean }
  | { readonly kind: "stop" };

interface Playing {
  readonly order: Extract<SceneOrder, { kind: "play" }>;
  readonly card: SceneCard;
  readonly painter: GridPainter;
  readonly image: ImageData;
}

const scope = self as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<SceneOrder>) => void): void;
  requestAnimationFrame(run: () => void): number;
  cancelAnimationFrame(handle: number): void;
};

let context: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | undefined;
let playing: Playing | undefined;
let running = false;
let frame: number | undefined;

function paint(box: Box | undefined): void {
  if (box === undefined || context === null || playing === undefined) return;
  context.putImageData(playing.image, 0, 0, box.x, box.y, box.width, box.height);
}

/** Paints the scene at moment `t`, in seconds. */
function draw(t: number): void {
  if (playing === undefined) return;
  const { card, painter, order } = playing;
  const stage = { cols: order.cols, rows: order.rows };
  const eyes = { open: card.eyes(t), fit: homeFit(stage), at: card.eyesAt?.(t, stage) ?? null };
  paint(painter.paint(card.frame(t, stage), eyes));
}

function tick(): void {
  frame = undefined;
  if (playing === undefined || !running) return;
  const t = (Date.now() - playing.order.startedAt) / 1000;
  draw(Math.min(Math.max(0, t), playing.card.end));
  // The last frame is Aski at home; the page fades the scene out over it.
  if (t < playing.card.end) frame = scope.requestAnimationFrame(tick);
}

function run(next: boolean): void {
  running = next;
  if (frame !== undefined) scope.cancelAnimationFrame(frame);
  frame = undefined;
  if (!running || playing === undefined) return;
  if (playing.order.still) draw(playing.card.still);
  else tick();
}

scope.addEventListener("message", (event) => {
  const order = event.data;
  if (order.kind === "canvas") {
    canvas = order.canvas;
    context = canvas.getContext("2d");
    return;
  }
  if (order.kind === "run") return run(order.running);
  if (frame !== undefined) scope.cancelAnimationFrame(frame);
  frame = undefined;
  playing = undefined;
  context?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0);
  if (order.kind === "stop" || canvas === undefined) return;
  const make = SCENE_CARDS[order.id];
  if (make === undefined) return;
  const painter = new GridPainter({ cols: order.cols, rows: order.rows }, order);
  canvas.width = painter.width;
  canvas.height = painter.height;
  playing = {
    order,
    card: make({ seed: order.seed }),
    painter,
    image: new ImageData(
      painter.pixels as Uint8ClampedArray<ArrayBuffer>,
      painter.width,
      painter.height,
    ),
  };
  run(order.running);
});
