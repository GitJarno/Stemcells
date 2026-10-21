/**
 * The Cell over a composer hung past the line's start, over the transcript:
 * its box stood on the field's edge, and what it wears reaches past the box
 * (a weld mask, claws). Where its farthest pixel lands, in CSS pixels from
 * the line's start, from the pictures a 2× display draws.
 */
import { describe, expect, it } from "vite-plus/test";

import { PACK_OUTFITS, PACKS, SCENES } from "../cell/kit";
import { POINTS_PER_PIXEL } from "../cell/look";
import { MARGIN, outfitLook, packLook, sceneOf } from "../cell/scene";
import { CELL_STANDS_IN } from "./stand";

type Look = ReturnType<typeof packLook>;

/** The first hero column a scene's frames draw in, its margin included; Infinity for none. */
const firstColumn = (look: Look, key: string) =>
  Math.min(
    ...(sceneOf(look, key)?.mini ?? []).flatMap((frame) =>
      frame.drawn.detail.map((row) => row.search(/[^.]/)).filter((x) => x >= 0),
    ),
  );

/** Where that column lands on the line: the canvas reaches past the box by the margin, a hero column is half a cell. */
const onLine = (column: number) =>
  CELL_STANDS_IN - MARGIN.x * POINTS_PER_PIXEL + (column * POINTS_PER_PIXEL) / 2;

const dressed: Look[] = [
  ...PACKS.flatMap((pack) => pack.pieces.map((piece) => packLook([`${pack.theme}/${piece.name}`]))),
  ...[...PACK_OUTFITS.keys()].flatMap((id) => outfitLook(id) ?? []),
];

describe("the Cell stands on the line's start", () => {
  it("nothing it wears hangs past the start, and the widest piece lands on it", () => {
    const edges = dressed.map((look) => onLine(firstColumn(look, "idle")));
    expect(Math.min(...edges)).toBe(0);
  });

  it("nothing it does carries it past the start", () => {
    const bare = packLook([]);
    for (const key of SCENES.keys())
      expect(onLine(firstColumn(bare, key)), key).toBeGreaterThanOrEqual(0);
  });
});
