// A Cell held still as an image: its picture at rest in what it wears, eyes open, in its
// provider's colours on the ground behind it. The Mac paints the same frame once to a canvas
// (`apps/web/src/stemcells/cell/CellStill.tsx`); a native view that draws only images takes
// it as a PNG.

import { bodyOf, frameShown, type Ground, keylined, paletteOf, sceneFor, wornLook } from "./kit";
import { pngOf, pngUri } from "./png";

/** Pixels to a cell of the hero detail: a picture under 128 pixels a side, which iOS keeps as it is. */
const SCALE = 3;

/** Stills kept, by look, body and ground; let go together once this many have gathered. */
const KEPT = 256;
const stills = new Map<string, string>();

/**
 * The Cell in `look` at rest on `ground`, in `provider`'s colours, as a PNG data URI. The first
 * time, its scene is composed: a few milliseconds, for the compose queue (`compose.ts`).
 */
export function stillUri(
  look: readonly string[],
  provider: string | null | undefined,
  ground: Ground,
): string {
  const body = bodyOf(provider);
  const key = `${look.join("+")}\n${body}\n${ground}`;
  const known = stills.get(key);
  if (known !== undefined) return known;
  const art = frameShown(sceneFor(wornLook(look), "awake", undefined, 0), "", undefined, false)
    .drawn.detail;
  const palette = paletteOf(body);
  const uri = pngUri(pngOf(ground === "light" ? keylined(art, palette) : art, palette, SCALE));
  if (stills.size >= KEPT) stills.clear();
  stills.set(key, uri);
  return uri;
}
