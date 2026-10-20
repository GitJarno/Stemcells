// What a Cell wears, as layers for the compositor: a back piece, an
// outfit's trim, a wrap, a face piece, headwear and the tool in its hands,
// each from the wardrobe library or a pack (`theme/piece`). Clothing is
// fabric too: a band recolours the body's own cells before anything is
// stamped, so it reaches the silhouette and follows every pose.

import {
  ACCESSORIES,
  animates,
  type Band,
  FABRICS,
  HEADWEAR,
  HERO,
  MINI,
  OUTFITS,
  type Piece,
  pieceOf,
  type Pose,
  POSED,
  type Slot,
  TOOLS,
  type Wardrobe,
} from "./kit.ts";
import { hero, mini } from "./rig.ts";
import { anchorOf, type Body, type Layer, miniOf } from "./sprite.ts";

/** Where a scene's clock stands for the pieces that animate: frame `tick` of `rate` a second. */
export interface Beat {
  readonly tick: number;
  readonly rate: number;
}

export const STILL: Beat = { tick: 0, rate: 1 };

/** The frame of `piece` shown at `beat`. */
export const frameAt = (piece: Piece, beat: Beat): number =>
  animates(piece)
    ? Math.trunc((beat.tick * piece.fps) / Math.max(beat.rate, 1)) % piece.frames.length
    : 0;

const libraryPiece = (name: string, library: ReadonlyMap<string, Layer>) =>
  library.get(name) ?? POSED.get(name);

/** A worn piece at `beat`: the library's, or a pack's in `slot`. */
function worn(
  name: string,
  library: ReadonlyMap<string, Layer>,
  slot: Slot,
  beat: Beat,
): Layer | undefined {
  const piece = libraryPiece(name, library);
  if (piece !== undefined) return piece;
  const packed = pieceOf(name, slot);
  return packed === undefined ? undefined : packed.frames[frameAt(packed, beat)];
}

/** Every layer `wardrobe` adds, in the order they stack at one depth, the worn ones marked. */
export function layersOf(wardrobe: Wardrobe, compact: boolean, beat: Beat = STILL): Layer[] {
  const out: Layer[] = [];
  const add = (layer: Layer | undefined, isWorn = true) => {
    if (layer === undefined) return;
    const marked = { ...layer, worn: isWorn };
    out.push(compact ? miniOf(marked) : marked);
  };
  if (wardrobe.back !== undefined) add(worn(wardrobe.back, new Map(), "back", beat));
  if (wardrobe.outfit !== undefined) OUTFITS.get(wardrobe.outfit)?.trim.forEach((l) => add(l));
  if (wardrobe.wrap !== undefined) add(worn(wardrobe.wrap, new Map(), "wrap", beat));
  if (wardrobe.accessory !== undefined) add(worn(wardrobe.accessory, ACCESSORIES, "face", beat));
  if (wardrobe.headwear !== undefined) add(worn(wardrobe.headwear, HEADWEAR, "headwear", beat));
  if (wardrobe.held !== undefined) add(TOOLS.get(wardrobe.held), false);
  return out;
}

/** How far the headwear reaches above the crown, hero and miniature rows, at the tallest of its frames. */
export function headroomOf(wardrobe: Wardrobe): { hero: number; mini: number } | undefined {
  if (wardrobe.headwear === undefined) return undefined;
  const library = libraryPiece(wardrobe.headwear, HEADWEAR);
  const frames =
    pieceOf(wardrobe.headwear, "headwear")?.frames ?? (library === undefined ? [] : [library]);
  if (frames.length === 0) return undefined;
  const above = (layer: Layer) => {
    const first = layer.art.findIndex((row) => [...row].some((cell) => cell !== "."));
    return layer.hotspot.y - (first < 0 ? layer.hotspot.y : first);
  };
  return {
    hero: Math.max(...frames.map(above)),
    mini: Math.max(...frames.map((frame) => above(miniOf(frame)))),
  };
}

/** The pack pieces worn that animate: a scene folds their cycles in. */
export function animatedOf(wardrobe: Wardrobe): Piece[] {
  const slots: [string | undefined, Slot][] = [
    [wardrobe.headwear, "headwear"],
    [wardrobe.accessory, "face"],
    [wardrobe.wrap, "wrap"],
    [wardrobe.back, "back"],
  ];
  return slots.flatMap(([name, slot]) => {
    const piece = name === undefined ? undefined : pieceOf(name, slot);
    return piece !== undefined && animates(piece) ? [piece] : [];
  });
}

/** The fabric the body is dyed in: a pack fabric's, else the library outfit's. */
export const fabricOf = (wardrobe: Wardrobe): readonly Band[] | undefined =>
  (wardrobe.fabric === undefined ? undefined : FABRICS.get(wardrobe.fabric)) ??
  (wardrobe.outfit === undefined ? undefined : OUTFITS.get(wardrobe.outfit)?.fabric);

/**
 * The body in `pose`, hero or miniature, dressed in `fabric`. The body is
 * one mound, all torso: a band's rows ride its breath, or, when it doesn't
 * breathe, count from the ground it stands on (a hop, a float).
 */
export function dyed(fabric: readonly Band[], pose: Pose, compact: boolean): Body {
  const drawn: Body = compact ? mini(pose) : hero(pose);
  const standing = compact ? MINI : HERO;
  const breath = anchorOf(drawn, "torso").y - anchorOf(standing, "torso").y;
  const planted = anchorOf(drawn, "ground").y - anchorOf(standing, "ground").y;
  const dye = (grid: readonly string[]) =>
    grid.map((row, y) =>
      [...row]
        .map((role, x) => {
          if (role === ".") return role;
          for (const band of fabric) {
            if (!band.parts.includes("torso")) continue;
            if (band.only !== undefined && band.only !== (compact ? "mini" : "hero")) continue;
            const r = band.rides ? y - breath : y - planted;
            const rows = compact ? band.miniRows : band.rows;
            if (rows !== undefined && (r < rows[0]! || r > rows[1]!)) continue;
            const columns = compact ? band.miniColumns : band.columns;
            if (columns !== undefined && (x < columns[0]! || x > columns[1]!)) continue;
            const fabricRole = band.map[role];
            if (fabricRole !== undefined) return fabricRole;
          }
          return role;
        })
        .join(""),
    );
  return { ...drawn, rows: dye(drawn.rows), features: dye(drawn.features) };
}
