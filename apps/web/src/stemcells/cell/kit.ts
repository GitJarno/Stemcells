// The Cell kit: its art and moves as data, read once into the shapes the
// rig and the compositor draw with. `kit/*.json` is exported from the
// original Swift app's sources and never edited by hand; `art/` is drawn
// for Stemcells beside it (`art.ts`, formats in `stemcells/docs/cell-art.md`).

import bodyData from "./kit/body.json" with { type: "json" };
import movesData from "./kit/moves.json" with { type: "json" };
import packsData from "./kit/packs.json" with { type: "json" };
import paletteData from "./kit/palette.json" with { type: "json" };
import wardrobeData from "./kit/wardrobe.json" with { type: "json" };
import { ART_MOVES, ART_PACKS, ART_TEMPERAMENTS } from "./art.ts";
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
  /** A pack piece worn on the back, behind the body. */
  readonly back?: string | undefined;
  /** A pack's fabric (`theme/fabric`): it dyes the body over a library outfit's. */
  readonly fabric?: string | undefined;
}

/** A curated look: one silhouette piece and at most one supporting piece. */
export interface Look {
  readonly name: string;
  readonly wardrobe: Wardrobe;
}

export const LOOKS: readonly Look[] = wardrobeData.looks;

// ── Packs

export type Slot = "headwear" | "face" | "wrap" | "back";

/** A pack piece: one layer per frame, the still first, cycling at `fps` while it animates. */
export interface Piece {
  readonly theme: string;
  readonly name: string;
  readonly slot: Slot;
  readonly frames: readonly Layer[];
  readonly fps: number;
  /** The piece worn in its place in the scenes a state names (`building` → `weldmask-down`). */
  readonly poses: Readonly<Record<string, string>>;
  /** A posed variant only: worn in another piece's place, never dealt alone. */
  readonly posed: boolean;
  /** It is the eyes (a mask, goggles): it frees them, posed away, where the face carries state. */
  readonly eyes: boolean;
  /** What it is and where it is worn, for a piece of a celebration. */
  readonly about?: string | undefined;
}

/** A pack's season: a window every year, or one dated year by year (a moving feast). */
export type Season =
  | { readonly from: string; readonly to: string }
  | { readonly years: Readonly<Record<string, readonly [from: string, to: string]>> };

/** An outfit's fabric in another colour. */
export interface Colourway {
  readonly id: string;
  /** A fabric (`theme/fabric`). */
  readonly fabric: string;
}

/**
 * A pack's outfit: pieces dealt as one, with its fabric and cheer. A piece
 * is a pack's (`theme/piece`) or the original's library's (`helm`), and
 * `outfit` wears a library outfit (`plate`: its fabric and trim).
 */
export interface PackOutfit {
  readonly theme: string;
  readonly name: string;
  readonly outfit?: string | undefined;
  readonly headwear?: string | undefined;
  readonly face?: string | undefined;
  readonly wrap?: string | undefined;
  readonly back?: string | undefined;
  /** A fabric (`theme/fabric`) worn when no colourway is picked. */
  readonly fabric?: string | undefined;
  readonly colourways: readonly Colourway[];
  /** A cheer (`theme/cheer`) played for `happy`. */
  readonly cheer?: string | undefined;
  /** What it reads as at a glance, and its colour family: a crew wears no two alike. */
  readonly silhouette: string;
  readonly family: string;
}

export interface Pack {
  readonly theme: string;
  readonly season: Season | null;
  readonly pieces: readonly Piece[];
  readonly outfits: readonly PackOutfit[];
  /** Drawn for Stemcells (`art/`), not exported from the original. */
  readonly authored: boolean;
  readonly about?: string | undefined;
}

const SLOT_ANCHOR: Readonly<Record<Slot, Anchor>> = {
  headwear: "headTop",
  face: "eyes",
  wrap: "ground",
  back: "back",
};

/** A back piece sits behind the body, a wrap over it and under the face the rig draws again, the rest over the face. */
const slotDepth = (slot: Slot): number => (slot === "back" ? -1 : slot === "wrap" ? 1 : 3);

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
  readonly poses?: Readonly<Record<string, string>>;
  readonly posed?: boolean;
  readonly eyes?: boolean;
  readonly about?: string;
}

interface OutfitData {
  readonly id: string;
  readonly outfit?: string;
  readonly headwear?: string;
  readonly face?: string;
  readonly wrap?: string;
  readonly back?: string;
  readonly fabric?: string;
  readonly colourways?: readonly Colourway[];
  readonly cheer?: string;
  readonly silhouette: string;
  readonly family: string;
}

/** A drawn fabric that says what it is: its bands, and its `about`. */
export interface FabricData {
  readonly about: string;
  readonly bands: readonly Band[];
}

/** A pack as its file holds it: the export's, or one drawn in `art/packs/`. */
export interface PackData {
  readonly theme: string;
  readonly season: Season | null;
  readonly about?: string;
  readonly pieces: readonly PieceData[];
  readonly fabrics?: Readonly<Record<string, readonly Band[] | FabricData>>;
  readonly outfits?: readonly OutfitData[];
  readonly cheers?: Readonly<Record<string, MoveData>>;
}

const pieceOfData = (theme: string, data: PieceData): Piece => {
  const slot = data.slot as Slot;
  const heroes = data.frames ?? [data.art];
  const minis = data.miniFrames ?? [data.mini];
  return {
    theme,
    name: data.name,
    slot,
    fps: heroes.length > 1 ? (data.fps ?? 0) : 0,
    frames: heroes.map((art, i) => ({
      art,
      attach: SLOT_ANCHOR[slot] ?? "headTop",
      hotspot: point(data.hotspot),
      z: data.z ?? slotDepth(slot),
      mini: minis[i] ?? data.mini,
      miniHotspot: point(data.miniHotspot),
      worn: false,
    })),
    poses: data.poses ?? {},
    posed: data.posed ?? false,
    eyes: data.eyes ?? false,
    about: data.about,
  };
};

/** A pack file read into the kit's shapes; `authored` for one drawn in `art/packs/`. */
export function packOf(data: PackData, authored: boolean): Pack {
  return {
    theme: data.theme,
    season: data.season,
    pieces: data.pieces.map((piece) => pieceOfData(data.theme, piece)),
    outfits: (data.outfits ?? []).map(({ id, colourways, ...outfit }) => ({
      ...outfit,
      theme: data.theme,
      name: id,
      colourways: colourways ?? [],
    })),
    authored,
    about: data.about,
  };
}

/** The pack files drawn for Stemcells, by file name. */
export const PACK_FILES: ReadonlyMap<string, PackData> = new Map(
  Object.entries(ART_PACKS) as [string, PackData][],
);

const EXPORTED_PACKS = (packsData.packs as readonly PackData[]).map((pack) => packOf(pack, false));

/** Every pack: the original's, then those drawn since. A drawn pack never replaces the original's. */
export const PACKS: readonly Pack[] = [
  ...EXPORTED_PACKS,
  ...[...PACK_FILES.values()]
    .filter((pack) => !EXPORTED_PACKS.some((exported) => exported.theme === pack.theme))
    .map((pack) => packOf(pack, true)),
];

const PIECES = new Map(
  PACKS.flatMap((pack) => pack.pieces.map((piece) => [`${piece.theme}/${piece.name}`, piece])),
);

/** A pack piece by id (`theme/piece`), when it sits in `slot`. */
export function pieceOf(id: string, slot?: Slot): Piece | undefined {
  const piece = PIECES.get(id);
  return piece !== undefined && (slot === undefined || piece.slot === slot) ? piece : undefined;
}

export const animates = (piece: Piece): boolean => piece.frames.length > 1 && piece.fps > 0;

/** The packs' fabrics by id (`theme/fabric`). */
export const FABRICS: ReadonlyMap<string, readonly Band[]> = new Map(
  [...PACK_FILES.values()].flatMap((pack) =>
    Object.entries(pack.fabrics ?? {}).map(([name, fabric]) => [
      `${pack.theme}/${name}`,
      "bands" in fabric ? fabric.bands : fabric,
    ]),
  ),
);

/** The packs' outfits by id (`theme/outfit`). */
export const PACK_OUTFITS: ReadonlyMap<string, PackOutfit> = new Map(
  PACKS.flatMap((pack) =>
    pack.outfits.map((outfit) => [`${pack.theme}/${outfit.name}`, outfit] as const),
  ),
);

// ── Moves

/** A soft arm pushed out of one side: its height on the body (0 base, 1 crown) and its reach. */
export interface Arm {
  readonly side: number;
  readonly at: number;
  readonly dx: number;
  readonly dy: number;
  /** Rows of biceps over the upper arm, light on top: a strong Cell's (`STRENGTH_ARMS`). */
  readonly bulge?: number | undefined;
}

/** How strong a Cell has grown from the time it worked alone (`growth.ts`), weakest first. */
export const STRENGTHS = ["nubs", "arms", "biceps"] as const;
export type Strength = (typeof STRENGTHS)[number];

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
  /** For a move that travels: how far the Cell stands from its place, in hero cells. */
  readonly dx?: number | undefined;
  /** The Cell is gone this frame: its body and what it wears aren't drawn, the frame's layers are. */
  readonly hidden?: boolean | undefined;
}

/** How a move plays among the others: what Reduce Motion holds, what it hands back to, what it costs. */
export interface MoveMeta {
  /** Loops while its state holds, plays once and hands back (`next`), or holds its last frame. */
  readonly kind?: "loop" | "once" | "hold" | undefined;
  /** Its rung on the ladder: the higher wins. */
  readonly priority?: number | undefined;
  readonly tier?: "common" | "rare" | "legendary" | "secret" | undefined;
  /** Whether it needs the lively token (cheers, laps, flexes, fidgets, rare beats). */
  readonly lively?: boolean | undefined;
  /** The frame that tells it: the one Reduce Motion holds. */
  readonly tell?: number | undefined;
  /** The scene it hands back to. */
  readonly next?: string | undefined;
  /** Frames to wait before a cut while it is in the air. */
  readonly land?: number | undefined;
  /** How far a travelling move goes beyond the box, in hero cells. */
  readonly stage?: number | undefined;
  /** Timed to sound: it may run at 24 frames a second. */
  readonly sound?: boolean | undefined;
  /** The layers of its frames draw the Cell's arms (the flex): a strong Cell's arms stand aside in those frames. */
  readonly ownArms?: boolean | undefined;
}

export interface Move {
  readonly fps: number;
  readonly facing: "left" | "right";
  readonly frames: readonly Frame[];
  readonly meta: MoveMeta;
}

/** A scene a Cell plays: its move, the tool it holds, how its worn animated pieces run. */
export interface Scene extends Move {
  /** Whether the scene puts a tool in its hands (`held`, none for empty hands) in place of the look's. */
  readonly holds: boolean;
  readonly held?: string | undefined;
  readonly pieces: "loop" | "once" | "still";
}

/** A move as its file holds it: the export's layers by index, a drawn one's inline. */
export interface MoveData extends MoveMeta {
  readonly fps: number;
  readonly facing: string;
  readonly frames: readonly {
    readonly pose: Partial<Omit<Pose, "look" | "arms">> & {
      readonly look?: readonly number[];
      readonly arms?: readonly Arm[];
    };
    readonly layers?: readonly (number | LayerData)[];
    readonly swaps?: Readonly<Record<string, string>>;
    readonly dx?: number;
    readonly hidden?: boolean;
  }[];
}

interface SceneData extends MoveData {
  readonly holds?: boolean;
  readonly held?: string;
  readonly pieces?: string;
}

/** A move set as its file in `art/moves/` holds it: new scenes, meta for the export's, and the arms a strength holds at rest. */
export interface MoveFile {
  readonly scenes?: Readonly<Record<string, SceneData>>;
  readonly meta?: Readonly<Record<string, MoveMeta>>;
  readonly strength?: Readonly<Partial<Record<Strength, Omit<Arm, "side">>>>;
}

const MOVE_LAYERS = (movesData.layers as readonly LayerData[]).map(layer);

const META_KEYS = [
  "kind",
  "priority",
  "tier",
  "lively",
  "tell",
  "next",
  "land",
  "stage",
  "sound",
  "ownArms",
] as const satisfies readonly (keyof MoveMeta)[];

/** A move file's meta, and nothing else it holds. */
const metaOf = (data: MoveMeta): MoveMeta =>
  Object.fromEntries(
    META_KEYS.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]),
  ) as MoveMeta;

const move = (data: MoveData, meta: MoveMeta = {}): Move => ({
  fps: data.fps,
  facing: data.facing === "left" ? "left" : "right",
  frames: data.frames.map((frame) => ({
    pose: {
      ...REST,
      ...frame.pose,
      look: frame.pose.look === undefined ? REST.look : point(frame.pose.look),
    },
    layers: (frame.layers ?? []).flatMap((at) =>
      typeof at === "number" ? (MOVE_LAYERS[at] ?? []) : [layer(at)],
    ),
    swaps: frame.swaps ?? {},
    ...(frame.dx === undefined ? {} : { dx: frame.dx }),
    ...(frame.hidden === true ? { hidden: true } : {}),
  })),
  meta: { ...metaOf(data), ...meta },
});

const scene = (data: SceneData, meta?: MoveMeta): Scene => ({
  ...move(data, meta),
  holds: data.holds ?? false,
  held: data.held,
  pieces: (data.pieces ?? "loop") as Scene["pieces"],
});

/** The move files drawn for Stemcells, by file name. */
export const MOVE_FILES: ReadonlyMap<string, MoveFile> = new Map(
  Object.entries(ART_MOVES) as [string, MoveFile][],
);

const DRAWN_META: Readonly<Record<string, MoveMeta>> = Object.assign(
  {},
  ...[...MOVE_FILES.values()].map((file) => file.meta ?? {}),
);

/** The arm a Cell of each strength holds at either side while a move leaves that side free. */
export const STRENGTH_ARMS: ReadonlyMap<Strength, Omit<Arm, "side">> = new Map(
  [...MOVE_FILES.values()].flatMap((file) =>
    STRENGTHS.flatMap((strength) => {
      const arm = file.strength?.[strength];
      return arm === undefined ? [] : [[strength, arm] as const];
    }),
  ),
);

/** The scenes drawn for Stemcells, by name. */
export const DRAWN_SCENES: ReadonlyMap<string, Scene> = new Map(
  [...MOVE_FILES.values()].flatMap((file) =>
    Object.entries(file.scenes ?? {}).map(([name, data]) => [name, scene(data)] as const),
  ),
);

/** The original's scenes by name, with any meta drawn for them. */
export const EXPORTED_SCENES: ReadonlyMap<string, Scene> = new Map(
  Object.entries(movesData.scenes as Readonly<Record<string, SceneData>>).map(
    ([name, data]) => [name, scene(data, DRAWN_META[name])] as const,
  ),
);

/** Every scene by name: moods, work (`reading/0`), the work rotation (`busy/3`), and those drawn since. A drawn scene never replaces the original's. */
export const SCENES: ReadonlyMap<string, Scene> = new Map([
  ...EXPORTED_SCENES,
  ...[...DRAWN_SCENES].filter(([name]) => !EXPORTED_SCENES.has(name)),
]);

/** The cheers played in place of `happy`: the curated looks' by look, the packs' by `theme/cheer`. */
export const CHEERS: ReadonlyMap<string, Move> = new Map([
  ...Object.entries(movesData.cheers as Readonly<Record<string, MoveData>>).map(
    ([look, data]) => [look, move(data)] as const,
  ),
  ...[...PACK_FILES.values()].flatMap((pack) =>
    Object.entries(pack.cheers ?? {}).map(
      ([name, data]) => [`${pack.theme}/${name}`, move(data)] as const,
    ),
  ),
]);

// ── Temperaments

/** How a Cell carries itself between moves: its breath, its blink, its glances, its beats. */
export interface Temperament {
  readonly id: string;
  /** How often it is dealt, against the others. */
  readonly weight: number;
  readonly breath: {
    readonly periodMs: number;
    readonly depthRows: number;
    readonly puff?: boolean;
  };
  readonly blink: { readonly windowMs: number; readonly shutMs: number; readonly double: boolean };
  /** How long it takes to notice a moment. */
  readonly noticeMs: number;
  readonly gaze: readonly { readonly look: readonly number[]; readonly holdMs: number }[];
  /** The scene it fidgets with. */
  readonly fidget: string;
  /** Its own take on the moments, as scene names. */
  readonly beats: Readonly<Record<"onIt" | "landed" | "needsYou" | "wake" | "sleep", string>>;
}

/** The temperaments, by id. */
export const TEMPERAMENTS: ReadonlyMap<string, Temperament> = new Map(
  (Object.values(ART_TEMPERAMENTS) as Temperament[]).map((t) => [t.id, t]),
);
