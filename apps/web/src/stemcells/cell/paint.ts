// A Cell's picture on a canvas: each frame rastered once per body at one
// image pixel a cell, then drawn scaled with no smoothing, so its cells keep
// their edges.

import { pictureOf } from "./cast.ts";
import { paletteOf } from "./kit.ts";
import type { MiniFrame } from "./scene.ts";

/** `#rrggbb` or `#rrggbbaa` as its four channels. */
function channels(hex: string): readonly [number, number, number, number] {
  const n = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  return [n(1), n(3), n(5), hex.length > 7 ? n(7) : 255];
}

const inks = new Map<string, ReadonlyMap<string, readonly [number, number, number, number]>>();

function inksOf(body: string): ReadonlyMap<string, readonly [number, number, number, number]> {
  let known = inks.get(body);
  if (known === undefined) {
    known = new Map(Object.entries(paletteOf(body)).map(([role, hex]) => [role, channels(hex)]));
    inks.set(body, known);
  }
  return known;
}

/** `rows` in `body`'s colours as RGBA, a pixel a cell; a cell with no colour (`.`) stays clear. */
export function pixelsOf(rows: readonly string[], body: string): Uint8ClampedArray<ArrayBuffer> {
  const width = rows[0]?.length ?? 0;
  const out = new Uint8ClampedArray(width * rows.length * 4);
  const colours = inksOf(body);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour = colours.get(row[x]!);
      if (colour !== undefined) out.set(colour, (y * width + x) * 4);
    }
  });
  return out;
}

/** Rasters kept, by body and rows; let go together once this many have gathered. */
const KEPT = 2048;
const rasters = new Map<string, HTMLCanvasElement>();

function raster(rows: readonly string[], body: string): HTMLCanvasElement {
  const key = `${body}\n${rows.join("\n")}`;
  const known = rasters.get(key);
  if (known !== undefined) return known;
  const canvas = document.createElement("canvas");
  canvas.width = rows[0]?.length ?? 0;
  canvas.height = rows.length;
  if (canvas.width > 0 && canvas.height > 0)
    canvas
      .getContext("2d")
      ?.putImageData(new ImageData(pixelsOf(rows, body), canvas.width, canvas.height), 0, 0);
  if (rasters.size >= KEPT) rasters.clear();
  rasters.set(key, canvas);
  return canvas;
}

/**
 * Paints `frame` on `canvas` in `body`'s colours, `points` CSS pixels a
 * cell on a display of `dpr`: the hero detail where it lands on whole device
 * pixels, else the miniature. The canvas's CSS size is the caller's.
 */
export function paint(
  canvas: HTMLCanvasElement,
  frame: MiniFrame,
  body: string,
  points: number,
  dpr: number,
): void {
  const width = Math.round((frame.rows[0]?.length ?? 0) * points * dpr);
  const height = Math.round(frame.rows.length * points * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) return;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  context.drawImage(raster(pictureOf(frame, points, dpr).rows, body), 0, 0, width, height);
}
