// Cells as the app draws them: each dealt today's look by its name, playing the
// kit's scenes, rastered once per frame and drawn on whole device pixels.

import {
  BODIES,
  type CellLook,
  type CellScene,
  dayOf,
  isBlinking,
  looksOf,
  type MiniFrame,
  onBeat,
  pixelsOf,
  rowsOn,
  sceneOf,
  wornLook,
} from "./app-cells.ts";

export interface Cell {
  readonly name: string;
  /** Whose colours it wears: `claude`, `codex`, `gemini`, `kimi`. */
  readonly body: string;
  readonly look: CellLook;
}

/** A crew dealt today's looks, as every screen of the app deals them. */
export function crew(members: readonly (readonly [string, string])[]): Cell[] {
  const worn = looksOf(
    members.map(([name]) => name),
    dayOf(new Date()),
  );
  return members.map(([name, body]) => ({
    name,
    body,
    look: wornLook(worn.get(name)?.worn ?? []),
  }));
}

/** The frame `scene` shows `t` seconds in, its eyes shut while `cell` blinks. */
export function frameAt(cell: Cell, key: string, t: number): MiniFrame {
  const scene: CellScene = sceneOf(cell.look, key) ?? sceneOf(cell.look, "idle")!;
  const frames =
    scene.shut !== undefined && isBlinking(cell.name, t) ? scene.shut.mini : scene.mini;
  return frames[Math.trunc(Math.max(0, t) * onBeat(scene.fps)) % frames.length]!;
}

/** How long one pass of `key` takes, seconds. */
export function lengthOf(cell: Cell, key: string): number {
  const scene = sceneOf(cell.look, key) ?? sceneOf(cell.look, "idle")!;
  return scene.mini.length / onBeat(scene.fps);
}

const rasters = new Map<string, HTMLCanvasElement>();

/** A frame's hero art in `body`'s colours, a canvas pixel an art pixel. */
export function rasterOf(frame: MiniFrame, body: string): HTMLCanvasElement {
  const art = frame.drawn.detail;
  const key = `${body}\n${art.join("\n")}`;
  let canvas = rasters.get(key);
  if (canvas === undefined) {
    const rows = rowsOn(art, body, "black");
    canvas = document.createElement("canvas");
    canvas.width = rows[0]?.length ?? 1;
    canvas.height = rows.length;
    canvas
      .getContext("2d")!
      .putImageData(new ImageData(pixelsOf(rows, body), canvas.width, canvas.height), 0, 0);
    if (rasters.size > 1500) rasters.clear();
    rasters.set(key, canvas);
  }
  return canvas;
}

/** The art's rows below the feet: the frame's margin. */
export const BELOW = 2;

export interface Placement {
  /** The feet, device pixels. */
  readonly x: number;
  readonly y: number;
  /** Device pixels an art pixel: whole, so its pixels keep their edges. */
  readonly px: number;
  readonly alpha?: number;
  readonly flip?: boolean;
}

export function drawCell(
  context: CanvasRenderingContext2D,
  cell: Cell,
  frame: MiniFrame,
  { x, y, px, alpha = 1, flip = false }: Placement,
): void {
  const raster = rasterOf(frame, cell.body);
  const w = raster.width * px,
    h = raster.height * px;
  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = alpha;
  context.translate(Math.round(x), Math.round(y));
  if (flip) context.scale(-1, 1);
  context.drawImage(raster, -Math.round(w / 2), -h + BELOW * px, w, h);
  context.restore();
}

/** A body's main colour, for what it says and what it leaves. */
export const colourOf = (body: string): string => BODIES[body]?.B ?? "#EDE9E0";
