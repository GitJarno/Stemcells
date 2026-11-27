// What a Cell wears, on its modelled body (stemcells/tasks/cell-model.md, slice 3): the
// wardrobe's drawn pieces, the same art the drawn Cell wears, stamped on the model's picture
// where its head stands, so a hat rides the head through every act. A piece is flat art on a
// round body: it holds until the wardrobe is modelled piece by piece.

import { layersOf } from "../dress.ts";
import { HERO, paletteOf } from "../kit.ts";
import { wornLook } from "../scene.ts";
import { anchorOf, type Layer } from "../sprite.ts";
import type { Figure } from "./body.ts";
import { type Sprite, standOf, type View } from "./sprite.ts";

/** Half the drawn body's width, in its art's cells: the measure a piece was drawn against. */
const DRAWN_HALF = 13;

/**
 * How many pixels a cell of a piece takes on a head `half` pixels wide: whole where the head
 * is near the drawn body's size or a multiple of it, so the art keeps its pixels; else by halves.
 */
export function cellOf(half: number): number {
  const raw = half / DRAWN_HALF;
  const whole = Math.round(raw);
  return Math.max(1, Math.abs(raw - whole) <= 0.2 ? whole : Math.round(raw * 2) / 2);
}

/**
 * The model is seen from a side, so its face is off the head's middle. A piece on the head
 * goes this much of the way with it: a hood's opening meets the face, a hat sits a little forward.
 */
const TOWARD_FACE = 0.6;

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);

/** What a Cell in the look `ids` (`looks.ts`) has on, as the pieces `wear` stamps; pieces that move stand at their first frame. */
export const wornLayers = (ids: readonly string[]): readonly Layer[] =>
  ids.length === 0 ? [] : layersOf(wornLook(ids).wardrobe, false);

/** How far up an act takes the head from where it rests (a hop, a lift, a stretch), in the model's own measure. */
const RISE = 0.6;

type Stand = ReturnType<typeof standOf>;

const wornOf = (layers: readonly Layer[]) =>
  layers
    .map((layer, seq) => ({ layer, seq }))
    .filter(
      ({ layer }) => layer.worn && !layer.attach.startsWith("hand") && layer.attach !== "hold",
    )
    // Sorted in place: the phone runs this, and Hermes has no `toSorted`.
    .sort((a, b) => a.layer.z - b.layer.z || a.seq - b.seq)
    .map(({ layer }) => layer);

/** Where `layer`'s art starts on a picture whose head stands at `stand`, a cell of it `cell` pixels. */
function startOf(layer: Layer, stand: Stand, cell: number): readonly [number, number] {
  const top = anchorOf(HERO, "headTop");
  const eyes = anchorOf(HERO, "eyes");
  const at = anchorOf(HERO, layer.attach);
  const onFace = layer.attach === "eyes" || layer.attach === "mouth";
  const middle = onFace
    ? stand.eyes[0]
    : stand.crown[0] + (layer.z < 0 ? 0 : (stand.eyes[0] - stand.crown[0]) * TOWARD_FACE);
  // The anchor's cell: the one left of the middle line, as the drawn body's is.
  const left = middle + (at.x - top.x - 1) * cell;
  const up = onFace
    ? stand.eyes[1] + (at.y - eyes.y - 1) * cell
    : stand.crown[1] + (at.y - top.y) * cell;
  return [Math.round(left - layer.hotspot.x * cell), Math.round(up - layer.hotspot.y * cell)];
}

/**
 * The rows `view` lacks over its top for what `layers` wear on `resting`, the Cell at rest, with
 * the head as high as an act takes it: a tall hat is not cut off at a hop (`tallerView`).
 */
export function roomOver(resting: Figure, view: View, layers: readonly Layer[]): number {
  const worn = wornOf(layers);
  if (worn.length === 0) return 0;
  const stand = standOf(resting, view);
  const cell = cellOf(stand.half);
  const highest = Math.min(...worn.map((layer) => startOf(layer, stand, cell)[1]));
  return Math.max(0, Math.ceil((RISE * view.rows) / view.span - highest));
}

/**
 * Stamps what `layers` wear on `sprite`, a picture of `figure` in `view`, in `body`'s colours.
 * Pieces on the head go by its top, pieces on the face by its eyes; a piece behind the body
 * shows only past it. What is held in the hands is left out: the model has its own laptop.
 */
export function wear(
  sprite: Sprite,
  figure: Figure,
  view: View,
  layers: readonly Layer[],
  body: string,
): Sprite {
  const worn = wornOf(layers);
  if (worn.length === 0) return sprite;
  const palette = paletteOf(body);
  const stand = standOf(figure, view);
  const cell = cellOf(stand.half);
  const { width, height, pixels } = sprite;
  for (const layer of worn) {
    const [x0, y0] = startOf(layer, stand, cell);
    const tall = Math.round(layer.art.length * cell);
    const wide = Math.round((layer.art[0]?.length ?? 0) * cell);
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + tall); y++) {
      const row = layer.art[Math.floor((y - y0) / cell)];
      if (row === undefined) continue;
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + wide); x++) {
        const hex = palette[row[Math.floor((x - x0) / cell)] ?? "."];
        if (hex === undefined) continue;
        const to = (y * width + x) * 4;
        if (layer.z < 0 && pixels[to + 3] !== 0) continue;
        pixels[to] = channel(hex, 1);
        pixels[to + 1] = channel(hex, 3);
        pixels[to + 2] = channel(hex, 5);
        pixels[to + 3] = hex.length > 7 ? channel(hex, 7) : 255;
      }
    }
  }
  return sprite;
}
