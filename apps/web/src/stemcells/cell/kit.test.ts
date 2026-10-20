import * as NodeAssert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  ACCESSORIES,
  BODIES,
  CHEERS,
  EYES,
  HEADWEAR,
  HERO,
  MINI,
  MOUTHS,
  OUTFITS,
  PACKS,
  paletteOf,
  POSED,
  SCENES,
  TOOLS,
} from "./kit.ts";
import type { Layer } from "./sprite.ts";

const letters = (rows: readonly string[]) => [...rows.join("")].filter((cell) => cell !== ".");

test("every letter the Cell's art uses has a colour on every body", () => {
  const layers: Layer[] = [
    ...EYES.values(),
    ...MOUTHS.values(),
    ...HEADWEAR.values(),
    ...ACCESSORIES.values(),
    ...POSED.values(),
    ...TOOLS.values(),
    ...[...OUTFITS.values()].flatMap((outfit) => outfit.trim),
    ...PACKS.flatMap((pack) => pack.pieces.flatMap((piece) => piece.frames)),
    ...[...SCENES.values(), ...CHEERS.values()].flatMap((move) =>
      move.frames.flatMap((frame) => frame.layers),
    ),
  ];
  const used = new Set([
    ...letters(HERO.rows),
    ...letters(MINI.rows),
    ...layers.flatMap((layer) => [...letters(layer.art), ...letters(layer.mini ?? [])]),
    ...[...OUTFITS.values()].flatMap((outfit) =>
      (outfit.fabric ?? []).flatMap((band) => Object.values(band.map)),
    ),
  ]);
  for (const body of Object.keys(BODIES)) {
    const palette = paletteOf(body);
    NodeAssert.deepEqual(
      [...used].filter((letter) => palette[letter] === undefined),
      [],
      `${body}: letters with no colour`,
    );
  }
});
