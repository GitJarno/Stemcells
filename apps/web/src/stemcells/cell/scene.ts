// A Cell's scenes: a move played in what it wears, composed once into
// frames at both sizes, the hero (32 × 32) and the miniature (13 × 14), each
// miniature carrying its hero art cropped cell for cell as detail, and the
// same loop with its open eyes shut for the blink. A worn piece that
// animates is folded into the scene's own clock.

import {
  animatedOf,
  type Beat,
  dyed,
  fabricOf,
  frameAt,
  headroomOf,
  layersOf,
  STILL,
} from "./dress.ts";
import {
  animates,
  CHEERS,
  LOOKS,
  MOUTHS,
  type Move,
  type Piece,
  pieceOf,
  type Pose,
  SCENES,
  type Slot,
  TOOLS,
  type Wardrobe,
} from "./kit.ts";
import { fitted, hero, mini, seated } from "./rig.ts";
import { compose, crop, type Layer, miniOf, round } from "./sprite.ts";

/** The eyes a blink shuts, and the lids it shows instead. */
const SHUTS = new Set(["open", "calm"]);
const LIDS = "sleepy";

/** The whistle's pucker, drawn again over whatever the face wears, so every look whistles. */
const PUCKER: Layer | undefined = (() => {
  const mouth = MOUTHS.get("whistle");
  return mouth === undefined
    ? undefined
    : { ...mouth, attach: "mouth", z: Number.MAX_SAFE_INTEGER };
})();

/** Pose `index` of `move` as worn: the face blinked, a hop held under the hat, fabric, the tool, marks. */
function composeFrame(
  move: Move,
  index: number,
  wardrobe: Wardrobe,
  compact: boolean,
  blinking: boolean,
  beat: Beat = STILL,
): string[] {
  const frame = move.frames[index]!;
  const look: { -readonly [K in keyof Wardrobe]: Wardrobe[K] } = { ...wardrobe };
  if (look.headwear !== undefined) look.headwear = frame.swaps[look.headwear] ?? look.headwear;
  if (look.accessory !== undefined) look.accessory = frame.swaps[look.accessory] ?? look.accessory;
  let pose = frame.pose;
  if (blinking && SHUTS.has(pose.eyes)) pose = { ...pose, eyes: LIDS };
  const room = headroomOf(look);
  if (room !== undefined) pose = fitted(pose, room);
  const fabric = fabricOf(look);
  const held = look.held === undefined ? undefined : TOOLS.get(look.held);
  const body = seated(
    fabric !== undefined ? dyed(fabric, pose, compact) : compact ? mini(pose) : hero(pose),
    held,
    compact,
  );
  const effects = compact ? frame.layers.map(miniOf) : [...frame.layers];
  if (pose.mouth === "whistle" && PUCKER !== undefined)
    effects.push(compact ? miniOf(PUCKER) : PUCKER);
  const rows = compose(body, [...layersOf(look, compact, beat), ...effects]);
  return move.facing === "left" ? rows.map((row) => [...row].toReversed().join("")) : rows;
}

/** One frame at the miniature's size, with the hero art it stands for, at twice the density. */
export interface MiniFrame {
  readonly rows: readonly string[];
  readonly detail: readonly string[];
}

export interface CellScene {
  /** Frames a second. */
  readonly fps: number;
  readonly hero: readonly (readonly string[])[];
  readonly mini: readonly MiniFrame[];
  /** The same loop with its open eyes shut; absent when it never shows open eyes. */
  readonly shut?:
    | {
        readonly hero: readonly (readonly string[])[];
        readonly mini: readonly MiniFrame[];
      }
    | undefined;
}

/** What a scene's frames are drawn on: the sprite clock's beat, 12 a second. */
export const BEAT = 12;

/** `fps` on the beat: each frame held a whole number of beats, so nothing limps. */
export function onBeat(fps: number): number {
  if (!(fps > 0 && fps < BEAT)) return fps;
  return BEAT / Math.max(1, round(BEAT / fps));
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

/** The longest strip a fold makes before it settles for one pass of the move. */
const LONGEST_STRIP = 240;
/** The fastest clock a fold runs a scene at. */
const FASTEST_RATE = 12;

/**
 * A move's frames with its worn pieces' animation folded in: for each
 * frame, the pose and the clock the pieces read. The scene runs at a whole
 * multiple of the move's rate; looping, until the move and every cycle end
 * together (within `LONGEST_STRIP`).
 */
function fold(
  poses: number,
  fps: number,
  pieces: readonly Piece[],
  loops = true,
): { fps: number; poses: number[]; beats: Beat[] } {
  const moving = pieces.filter(animates);
  if (poses <= 0 || moving.length === 0 || fps < 1 || fps !== Math.round(fps)) {
    return {
      fps,
      poses: Array.from({ length: poses }, (_, i) => i),
      beats: Array.from({ length: poses }, () => STILL),
    };
  }
  const a = fps;
  const common = moving.reduce((rate, piece) => lcm(rate, piece.fps), a);
  const fastest = Math.max(...moving.map((piece) => piece.fps));
  const rate = common <= FASTEST_RATE ? common : a * Math.trunc((fastest + a - 1) / a);
  const hold = Math.trunc(rate / a);
  const passes = moving.reduce((t, piece) => {
    const m = piece.frames.length;
    return lcm(t, Math.trunc((m * a) / gcd(poses * piece.fps, m * a)));
  }, 1);
  let count = poses * hold;
  if (loops && count * passes <= LONGEST_STRIP) count *= passes;
  return {
    fps: rate,
    poses: Array.from({ length: count }, (_, i) => Math.trunc(i / hold) % poses),
    beats: Array.from({ length: count }, (_, tick) => ({ tick, rate })),
  };
}

const same = (a: readonly (readonly string[])[], b: readonly (readonly string[])[]) =>
  a.length === b.length && a.every((frame, i) => frame.join("\n") === b[i]!.join("\n"));

/** The hero art a miniature stands for: the hero cropped to the miniature's footprint, cell for cell. */
const detailOf = (hero: readonly string[]) => crop(hero, 3, 2, 26, 28);

/** `move` worn: every frame at both sizes, open and shut, its animated pieces run as `pieces` says. */
function composed(move: Move, wardrobe: Wardrobe, pieces: "loop" | "once" | "still"): CellScene {
  const moving = animatedOf(wardrobe);
  const folded =
    moving.length === 0
      ? { fps: move.fps, poses: move.frames.map((_, i) => i), beats: move.frames.map(() => STILL) }
      : pieces === "still"
        ? fold(move.frames.length, onBeat(move.fps), [])
        : fold(move.frames.length, onBeat(move.fps), moving, pieces === "loop");
  const made = new Map<string, readonly (readonly string[])[]>();
  const frames = folded.poses.map((pose, i) => {
    const beat = folded.beats[i]!;
    const key = [pose, ...moving.map((piece) => frameAt(piece, beat))].join(",");
    let frame = made.get(key);
    if (frame === undefined) {
      frame = [
        composeFrame(move, pose, wardrobe, false, false, beat),
        composeFrame(move, pose, wardrobe, true, false, beat),
        composeFrame(move, pose, wardrobe, false, true, beat),
        composeFrame(move, pose, wardrobe, true, true, beat),
      ];
      made.set(key, frame);
    }
    return frame;
  });
  const strip = (at: number) => frames.map((frame) => frame[at]!);
  const minis = (minis: readonly (readonly string[])[], heroes: readonly (readonly string[])[]) =>
    minis.map((rows, i) => ({ rows, detail: detailOf(heroes[i]!) }));
  const [heroOpen, miniOpen, heroShut, miniShut] = [strip(0), strip(1), strip(2), strip(3)];
  return {
    fps: folded.fps,
    hero: heroOpen,
    mini: minis(miniOpen, heroOpen),
    shut:
      same(heroShut, heroOpen) && same(miniShut, miniOpen)
        ? undefined
        : { hero: heroShut, mini: minis(miniShut, heroShut) },
  };
}

/** A look a Cell wears: its name (its scenes' identity), what it wears, and whose cheer it plays. */
export interface CellLook {
  readonly name: string;
  readonly wardrobe: Wardrobe;
  readonly cheer?: string | undefined;
}

/** A curated look by name, with its own cheer when it has one. */
export function curated(name: string): CellLook | undefined {
  const look = LOOKS.find((l) => l.name === name);
  return look === undefined
    ? undefined
    : { name, wardrobe: look.wardrobe, cheer: CHEERS.has(name) ? name : undefined };
}

const SLOT_FIELD: Readonly<Record<Slot, "headwear" | "accessory" | "wrap">> = {
  headwear: "headwear",
  face: "accessory",
  wrap: "wrap",
};

/** A look of pack pieces (`theme/piece`): each in its slot, a later piece winning a slot an earlier one holds. */
export function packLook(ids: readonly string[]): CellLook {
  const bySlot = new Map<Slot, string>();
  for (const id of ids) {
    const piece = pieceOf(id);
    if (piece !== undefined) bySlot.set(piece.slot, id);
  }
  const wardrobe: { -readonly [K in keyof Wardrobe]: Wardrobe[K] } = {};
  for (const [slot, id] of bySlot) wardrobe[SLOT_FIELD[slot]] = id;
  const worn = (["headwear", "face", "wrap"] as const).flatMap((slot) => bySlot.get(slot) ?? []);
  return { name: `pack:${worn.join("+")}`, wardrobe };
}

const scenes = new Map<string, CellScene>();

/**
 * The scene `key` (`idle`, `reading/0`, … in `kit/moves.json`) in `look`,
 * composed the first time it is asked for: a Cell pays for the scenes it
 * shows, never for the catalogue. A look with a cheer of its own plays it
 * for `happy`.
 */
export function sceneOf(look: CellLook, key: string): CellScene | undefined {
  const known = scenes.get(`${look.name}|${key}`);
  if (known !== undefined) return known;
  const scene = SCENES.get(key);
  if (scene === undefined) return undefined;
  const cheer = key === "happy" && look.cheer !== undefined ? CHEERS.get(look.cheer) : undefined;
  const wardrobe = scene.holds ? { ...look.wardrobe, held: scene.held } : look.wardrobe;
  const made = composed(cheer ?? scene, wardrobe, scene.pieces);
  scenes.set(`${look.name}|${key}`, made);
  return made;
}

/** `pose` held still in `look`, kept among its scenes as `name` (a name no scene in the kit has). */
export function stillOf(look: CellLook, name: string, pose: Pose): CellScene {
  const known = scenes.get(`${look.name}|${name}`);
  if (known !== undefined) return known;
  const still: Move = { fps: 0, facing: "right", frames: [{ pose, layers: [], swaps: {} }] };
  const made = composed(still, look.wardrobe, "still");
  scenes.set(`${look.name}|${name}`, made);
  return made;
}
