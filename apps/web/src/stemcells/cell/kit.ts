// The Cell kit: its art and moves as data (`kit/*.json`, exported from the
// original Swift app's sources and never edited by hand), read once into the
// shapes the rig and the compositor draw with.

import bodyData from "./kit/body.json" with { type: "json" };
import movesData from "./kit/moves.json" with { type: "json" };
import packsData from "./kit/packs.json" with { type: "json" };
import paletteData from "./kit/palette.json" with { type: "json" };
import wardrobeData from "./kit/wardrobe.json" with { type: "json" };
import type { Anchor, Body, Layer, Point } from "./sprite.ts";

interface LayerData {
  readonly art: readonly string[];
  readonly attach: string;
  readonly hotspot: readonly number[];
  readonly z: number;
  readonly mini?: readonly string[];
  readonly miniHotspot?: readonly number[];
  readonly worn?: boolean;
}

const point = (pair: readonly number[]): Point => ({ x: pair[0] ?? 0, y: pair[1] ?? 0 });

const layer = (data: LayerData): Layer => ({
  art: data.art,
  attach: data.attach as Anchor,
  hotspot: point(data.hotspot),
  z: data.z,
  mini: data.mini,
  miniHotspot: data.miniHotspot === undefined ? undefined : point(data.miniHotspot),
  worn: data.worn ?? false,
});

const library = (data: Readonly<Record<string, LayerData>>): ReadonlyMap<string, Layer> =>
  new Map(Object.entries(data).map(([name, piece]) => [name, layer(piece)]));

const drawn = (data: {
  readonly rows: readonly string[];
  readonly anchors: Readonly<Record<string, readonly number[]>>;
}): Body => ({
  rows: data.rows,
  anchors: Object.fromEntries(
    Object.entries(data.anchors).map(([name, pair]) => [name, point(pair)]),
  ) as Partial<Record<Anchor, Point>>,
  front: [],
  features: [],
});

// ── Palette

/** A body's four roles: B body, b shade, L highlight, O contour. */
export type BodyInks = Readonly<Record<"B" | "b" | "L" | "O", string>>;

/** Each provider's body, by the name the kit gives it, and `frost` (a frozen Cell). */
export const BODIES: Readonly<Record<string, BodyInks>> = paletteData.bodies;

/** Every other role's colour, the same on every body. */
export const INKS: Readonly<Record<string, string>> = paletteData.inks;

/** Every role a provider paints: its body and the shared inks. */
export function paletteOf(body: string): Readonly<Record<string, string>> {
  return { ...INKS, ...(BODIES[body] ?? BODIES.claude) };
}

// ── Body

export const RIG = bodyData.rig;
/** The hero drawn at rest (32 × 32) and the miniature (13 × 14). */
export const HERO: Body = drawn(bodyData.hero);
export const MINI: Body = drawn(bodyData.mini);
/** The faces and mouths the rig stamps, by name. */
export const EYES = library(bodyData.eyes);
export const MOUTHS = library(bodyData.mouths);

// ── Wardrobe

/** A fabric band: body roles it maps, on which parts, in which rows and columns. */
export interface Band {
  readonly parts: readonly string[];
  readonly map: Readonly<Record<string, string>>;
  readonly rides: boolean;
  readonly rows?: readonly number[];
  readonly columns?: readonly number[];
  readonly miniRows?: readonly number[];
  readonly miniColumns?: readonly number[];
  readonly only?: string;
}

export interface Outfit {
  readonly fabric?: readonly Band[] | undefined;
  readonly trim: readonly Layer[];
}

export const HEADWEAR = library(wardrobeData.headwear);
export const ACCESSORIES = library(wardrobeData.accessories);
export const POSED = library(wardrobeData.posed);
export const TOOLS = library(wardrobeData.tools);
export const OUTFITS: ReadonlyMap<string, Outfit> = new Map(
  Object.entries(wardrobeData.outfits).map(([name, outfit]) => [
    name,
    {
      fabric: "fabric" in outfit ? (outfit.fabric as readonly Band[]) : undefined,
      trim: outfit.trim.map(layer),
    },
  ]),
);

/** What a look names in each slot: library pieces, or a pack's as `theme/piece`. */
export interface Wardrobe {
  readonly headwear?: string | undefined;
  readonly accessory?: string | undefined;
  readonly outfit?: string | undefined;
  readonly held?: string | undefined;
  readonly wrap?: string | undefined;
}

/** A curated look: one silhouette piece and at most one supporting piece. */
export interface Look {
  readonly name: string;
  readonly wardrobe: Wardrobe;
}

export const LOOKS: readonly Look[] = wardrobeData.looks;

// ── Packs

export type Slot = "headwear" | "face" | "wrap";

/** A pack piece: one layer per frame, the still first, cycling at `fps` while it animates. */
export interface Piece {
  readonly theme: string;
  readonly name: string;
  readonly slot: Slot;
  readonly frames: readonly Layer[];
  readonly fps: number;
}

export interface Pack {
  readonly theme: string;
  readonly season: { readonly from: string; readonly to: string } | null;
  readonly pieces: readonly Piece[];
}

const SLOT_ANCHOR: Readonly<Record<Slot, Anchor>> = {
  headwear: "headTop",
  face: "eyes",
  wrap: "ground",
};

/** A wrap sits over the body and under the face the rig draws again; the rest over the face. */
const slotDepth = (slot: Slot): number => (slot === "wrap" ? 1 : 3);

interface PieceData {
  readonly name: string;
  readonly slot: string;
  readonly art: readonly string[];
  readonly hotspot: readonly number[];
  readonly z?: number;
  readonly mini: readonly string[];
  readonly miniHotspot: readonly number[];
  readonly frames?: readonly (readonly string[])[];
  readonly miniFrames?: readonly (readonly string[])[];
  readonly fps?: number;
}

export const PACKS: readonly Pack[] = (
  packsData.packs as readonly {
    readonly theme: string;
    readonly season: { readonly from: string; readonly to: string } | null;
    readonly pieces: readonly PieceData[];
  }[]
).map((pack) => ({
  theme: pack.theme,
  season: pack.season,
  pieces: pack.pieces.map((data) => {
    const slot = data.slot as Slot;
    const heroes = data.frames ?? [data.art];
    const minis = data.miniFrames ?? [data.mini];
    return {
      theme: pack.theme,
      name: data.name,
      slot,
      fps: heroes.length > 1 ? (data.fps ?? 0) : 0,
      frames: heroes.map((art, i) => ({
        art,
        attach: SLOT_ANCHOR[slot],
        hotspot: point(data.hotspot),
        z: data.z ?? slotDepth(slot),
        mini: minis[i] ?? data.mini,
        miniHotspot: point(data.miniHotspot),
        worn: false,
      })),
    };
  }),
}));

const PIECES = new Map(
  PACKS.flatMap((pack) => pack.pieces.map((piece) => [`${piece.theme}/${piece.name}`, piece])),
);

/** A pack piece by id (`theme/piece`), when it sits in `slot`. */
export function pieceOf(id: string, slot?: Slot): Piece | undefined {
  const piece = PIECES.get(id);
  return piece !== undefined && (slot === undefined || piece.slot === slot) ? piece : undefined;
}

export const animates = (piece: Piece): boolean => piece.frames.length > 1 && piece.fps > 0;

// ── Moves

/** A soft arm pushed out of one side: its height on the body (0 base, 1 crown) and its reach. */
export interface Arm {
  readonly side: number;
  readonly at: number;
  readonly dx: number;
  readonly dy: number;
}

/** One frame of the body, as the rig draws it. Lengths are hero cells. */
export interface Pose {
  readonly x: number;
  readonly base: number;
  readonly sy: number;
  readonly sx?: number | undefined;
  readonly lean: number;
  readonly spread: number;
  readonly face: number;
  readonly eyes: string;
  readonly mouth: string;
  readonly look: Point;
  readonly arms: readonly Arm[];
  readonly lift: number;
  readonly hatDX: number;
  readonly float: number;
}

export const REST: Pose = {
  x: RIG.restX,
  base: RIG.restBase,
  sy: 1,
  lean: 0,
  spread: 0,
  face: 0,
  eyes: "calm",
  mouth: "none",
  look: { x: 0, y: 0 },
  arms: [],
  lift: 0,
  hatDX: 0,
  float: 0,
};

export interface Frame {
  readonly pose: Pose;
  /** Marks and props this frame adds. */
  readonly layers: readonly Layer[];
  /** A worn piece shown as its posed variant this frame. */
  readonly swaps: Readonly<Record<string, string>>;
}

export interface Move {
  readonly fps: number;
  readonly facing: "left" | "right";
  readonly frames: readonly Frame[];
}

/** A scene a Cell plays: its move, the tool it holds, how its worn animated pieces run. */
export interface Scene extends Move {
  /** Whether the scene puts a tool in its hands (`held`, none for empty hands) in place of the look's. */
  readonly holds: boolean;
  readonly held?: string | undefined;
  readonly pieces: "loop" | "once" | "still";
}

interface MoveData {
  readonly fps: number;
  readonly facing: string;
  readonly frames: readonly {
    readonly pose: Partial<Omit<Pose, "look">> & { readonly look?: readonly number[] };
    readonly layers?: readonly number[];
    readonly swaps?: Readonly<Record<string, string>>;
  }[];
}

const MOVE_LAYERS = (movesData.layers as readonly LayerData[]).map(layer);

const move = (data: MoveData): Move => ({
  fps: data.fps,
  facing: data.facing === "left" ? "left" : "right",
  frames: data.frames.map((frame) => ({
    pose: {
      ...REST,
      ...frame.pose,
      look: frame.pose.look === undefined ? REST.look : point(frame.pose.look),
    },
    layers: (frame.layers ?? []).flatMap((i) => MOVE_LAYERS[i] ?? []),
    swaps: frame.swaps ?? {},
  })),
});

/** Every scene by name: moods, work (`reading/0`), the work rotation (`busy/3`). */
export const SCENES: ReadonlyMap<string, Scene> = new Map(
  Object.entries(
    movesData.scenes as Readonly<
      Record<string, MoveData & { holds?: boolean; held?: string; pieces: string }>
    >,
  ).map(([name, data]) => [
    name,
    {
      ...move(data),
      holds: data.holds ?? false,
      held: data.held,
      pieces: data.pieces as Scene["pieces"],
    },
  ]),
);

/** The curated looks' own cheers, played in place of `happy`. */
export const CHEERS: ReadonlyMap<string, Move> = new Map(
  Object.entries(movesData.cheers as Readonly<Record<string, MoveData>>).map(([look, data]) => [
    look,
    move(data),
  ]),
);
