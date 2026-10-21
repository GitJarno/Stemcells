// What the tools draw: a look named on the command line, a scene of it as
// strips and animations at both sizes on both frames, and sheets of many.

import { FRAMES, type Ground } from "../keyline.ts";
import { paletteOf, pieceOf, SCENES, STRENGTHS } from "../kit.ts";
import {
  type CellLook,
  type CellScene,
  curated,
  grown,
  marked,
  outfitLook,
  packLook,
  sceneOf,
} from "../scene.ts";
import { apng, png } from "./png.ts";
import { picture, Sheet, textWidth } from "./picture.ts";

export type Size = "hero" | "mini";

/** Pixels a cell is drawn at each size: the miniature's cell is twice the hero's, so both stand the same height. */
export const SCALE: Readonly<Record<Size, number>> = { hero: 4, mini: 8 };

export const SIZES: readonly Size[] = ["mini", "hero"];
export const GROUNDS: readonly Ground[] = ["black", "light"];

/**
 * A look by what the command line says: `bare`, a curated look (`builder`),
 * pack pieces (`gym/towel+gym/sweatband`), or a pack's outfit
 * (`outfit:gym/athlete`, `outfit:gym/athlete~sky` in a colourway); grown to
 * a strength after `@` (`bare@arms`), and after it, cheering a landing:
 * flexing (`:flex`), and with the marks of lines `:added` and `:removed`
 * (`bare@biceps:flex:added`, `bare@:added:removed`).
 */
export function lookOf(spec: string): CellLook {
  const [worn = "", growth] = spec.split("@");
  if (growth === undefined) return wornOf(worn);
  const [strength, ...landing] = growth.split(":");
  const known = STRENGTHS.find((s) => s === strength);
  if (strength !== "" && known === undefined) throw new Error(`no strength "${strength}"`);
  const look = grown(wornOf(worn), known, landing.includes("flex"));
  return marked(look, { added: landing.includes("added"), removed: landing.includes("removed") });
}

function wornOf(spec: string): CellLook {
  if (spec === "bare") return packLook([]);
  if (spec.startsWith("outfit:")) {
    const [id = "", colourway] = spec.slice("outfit:".length).split("~");
    const look = outfitLook(id, colourway);
    if (look === undefined) throw new Error(`no outfit "${id}"`);
    return look;
  }
  if (spec.includes("/")) {
    const ids = spec.split("+");
    const missing = ids.filter((id) => pieceOf(id) === undefined);
    if (missing.length > 0) throw new Error(`no piece ${missing.join(", ")}`);
    return packLook(ids);
  }
  const look = curated(spec);
  if (look === undefined) throw new Error(`no look "${spec}"`);
  return look;
}

/** A spec as a file name. */
export const slugOf = (spec: string): string => spec.replace(/[^a-z0-9~-]+/gi, "_");

/** The frames a size shows as the app draws them, with the margin past the box: the hero detail, or the miniature. */
export const framesOf = (scene: CellScene, size: Size): readonly (readonly string[])[] =>
  scene.mini.map((frame) => (size === "hero" ? frame.drawn.detail : frame.drawn.rows));

/** How far each frame of scene `key` stands from its place, in cells of `size`, for a move that travels. */
function offsetsOf(key: string, frames: number, size: Size): number[] {
  const move = SCENES.get(key);
  if (move === undefined || move.frames.length !== frames)
    return Array.from({ length: frames }, () => 0);
  return move.frames.map((frame) => Math.round((frame.dx ?? 0) / (size === "mini" ? 2 : 1)));
}

/** One frame, or a strip of them, on `ground`; a travelling move on a stage its width. */
function stage(
  key: string,
  frames: readonly (readonly string[])[],
  palette: Readonly<Record<string, string>>,
  size: Size,
  ground: Ground,
): Sheet[] {
  const scale = SCALE[size];
  const offsets = offsetsOf(key, frames.length, size);
  const reach = Math.max(0, ...offsets.map(Math.abs));
  return frames.map((rows, i) => {
    if (reach === 0) return picture(rows, palette, ground, scale);
    const drawn = picture(rows, palette, ground, scale);
    const sheet = new Sheet(drawn.width + 2 * reach * scale, drawn.height, FRAMES[ground]);
    paste(sheet, drawn, (reach + offsets[i]!) * scale, 0);
    return sheet;
  });
}

/** `from` copied onto `to` at (`x`, `y`). */
export function paste(to: Sheet, from: Sheet, x: number, y: number): void {
  for (let py = 0; py < from.height; py++) {
    for (let px = 0; px < from.width; px++) {
      const tx = x + px;
      const ty = y + py;
      if (tx < 0 || ty < 0 || tx >= to.width || ty >= to.height) continue;
      const s = (py * from.width + px) * 4;
      const t = (ty * to.width + tx) * 4;
      to.pixels.set(from.pixels.subarray(s, s + 4), t);
    }
  }
}

/** A scene's frames as one animation, each frame held as long as the scene's clock says. */
export function animation(
  look: CellLook,
  key: string,
  body: string,
  size: Size,
  ground: Ground,
): Uint8Array | undefined {
  const scene = sceneOf(look, key);
  if (scene === undefined) return undefined;
  const frames = stage(key, framesOf(scene, size), paletteOf(body), size, ground);
  const first = frames[0]!;
  return apng(
    first.width,
    first.height,
    frames.map((frame) => frame.pixels),
    scene.fps > 0 ? 1000 / scene.fps : 1000,
  );
}

const GAP = 8;
const INK = { black: "#EDE9E0", light: "#1F2328" } as const;

/** A look's scenes on one sheet: each scene's every frame, at both sizes, on both frames, labelled. */
export function sheetOf(spec: string, keys: readonly string[], body: string): Uint8Array {
  const look = lookOf(spec);
  const palette = paletteOf(body);
  const rows: { label: string; strip: Sheet[] }[] = [];
  for (const key of keys) {
    const scene = sceneOf(look, key);
    if (scene === undefined) throw new Error(`no scene "${key}"`);
    for (const size of SIZES)
      for (const ground of GROUNDS)
        rows.push({
          label: `${key} ${size} ${ground} ${scene.fps}fps`,
          strip: stage(key, framesOf(scene, size), palette, size, ground),
        });
  }
  const label = 16;
  const width =
    Math.max(
      textWidth(spec, 2),
      ...rows.map(({ strip }) => strip.reduce((w, f) => w + f.width + GAP, 0)),
    ) + GAP;
  const height =
    label * 2 + rows.reduce((h, { strip }) => h + label + (strip[0]?.height ?? 0) + GAP, 0);
  const sheet = new Sheet(width, height, "#16181C");
  sheet.text(spec, GAP, GAP, INK.black, 2);
  let y = label * 2;
  for (const { label: words, strip } of rows) {
    sheet.text(words, GAP, y, INK.black, 2);
    y += label;
    let x = GAP;
    for (const frame of strip) {
      paste(sheet, frame, x, y);
      x += frame.width + GAP;
    }
    y += (strip[0]?.height ?? 0) + GAP;
  }
  return png(sheet.width, sheet.height, sheet.pixels);
}

/** Looks side by side: each one's `keys` scenes (the first frame; the cheer at its height), mini and hero, on both frames, labelled. */
export function contactSheet(
  title: string,
  looks: readonly (readonly [label: string, look: CellLook])[],
  keys: readonly string[],
  body: string,
): Uint8Array {
  const palette = paletteOf(body);
  const tileW = 13 * SCALE.mini;
  const tileH = 14 * SCALE.mini;
  const cellW = tileW * 4 + GAP * 4;
  const columns = Math.max(1, Math.min(4, looks.length));
  const block = 16 + keys.length * (tileH + GAP) + GAP;
  const width = columns * (cellW + GAP) + GAP;
  const height = 32 + Math.ceil(looks.length / columns) * block;
  const sheet = new Sheet(width, height, "#16181C");
  sheet.text(title, GAP, GAP, INK.black, 2);
  looks.forEach(([label, look], i) => {
    const x0 = GAP + (i % columns) * (cellW + GAP);
    let y = 32 + Math.floor(i / columns) * block;
    sheet.text(label.slice(0, Math.floor(cellW / 8)), x0, y, INK.black, 2);
    y += 16;
    for (const key of keys) {
      const scene = sceneOf(look, key);
      if (scene === undefined) continue;
      const at = key === "happy" ? Math.floor(scene.mini.length / 2) : 0;
      let x = x0;
      for (const size of SIZES)
        for (const ground of GROUNDS) {
          const frame = framesOf(scene, size)[at];
          if (frame === undefined) continue;
          const drawn = picture(frame, palette, ground, SCALE[size]);
          paste(sheet, drawn, x, y);
          x += drawn.width + GAP;
        }
      y += tileH + GAP;
    }
  });
  return png(sheet.width, sheet.height, sheet.pixels);
}
