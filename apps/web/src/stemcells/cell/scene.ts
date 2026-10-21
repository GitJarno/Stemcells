// A Cell's scenes: a move played in what it wears, composed once into
// frames at both sizes, the hero (32 × 32) and the miniature (13 × 14), each
// miniature carrying its hero art cropped cell for cell as detail, both as a
// display draws them with a margin past the box, and the same loop with its
// open eyes shut for the blink. A worn piece that animates is folded into
// the scene's own clock.

import {
  animatedOf,
  type Beat,
  dyed,
  fabricOf,
  frameAt,
  backroomOf,
  headroomOf,
  layersOf,
  STILL,
} from "./dress.ts";
import {
  animates,
  type Arm,
  CHEERS,
  DIFF_MARKS,
  LOOKS,
  MOUTHS,
  type Frame,
  type Move,
  PACK_OUTFITS,
  type Piece,
  pieceOf,
  type Pose,
  REST,
  type Scene,
  SCENES,
  type Slot,
  type Strength,
  STRENGTH_ARMS,
  TOOLS,
  type Wardrobe,
} from "./kit.ts";
import { fitted, hero, mini, seated } from "./rig.ts";
import {
  anchorOf,
  type Body,
  compose,
  crop,
  type Layer,
  miniOf,
  type Point,
  round,
} from "./sprite.ts";

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

/** For the tools: the body without what it wears (`bare`) or its eyes (`eyeless`), and a count of worn cells off the grid. */
interface Probe {
  readonly bare?: boolean;
  readonly eyeless?: boolean;
  readonly spill?: { count: number };
}

/** `wardrobe` as `frame` shows it: each piece the frame swaps, posed. */
function swappedIn(frame: Frame, wardrobe: Wardrobe): Wardrobe {
  const look: { -readonly [K in keyof Wardrobe]: Wardrobe[K] } = { ...wardrobe };
  for (const field of ["headwear", "accessory", "wrap", "back"] as const) {
    const worn = look[field];
    if (worn !== undefined) look[field] = frame.swaps[worn] ?? worn;
  }
  return look;
}

/** Pose `index` of `move` as worn: its swaps, the face blinked, a hop held under the hat, fabric, the tool, marks. */
function composeFrame(
  move: Move,
  index: number,
  wardrobe: Wardrobe,
  compact: boolean,
  blinking: boolean,
  beat: Beat = STILL,
  probe: Probe = {},
): string[] {
  const frame = move.frames[index]!;
  const look = swappedIn(frame, wardrobe);
  let pose = frame.pose;
  if (blinking && SHUTS.has(pose.eyes)) pose = { ...pose, eyes: LIDS };
  if (probe.eyeless) pose = { ...pose, eyes: "none" };
  pose = fitted(pose, headroomOf(look), backroomOf(look));
  const fabric = probe.bare ? undefined : fabricOf(look);
  const held = look.held === undefined ? undefined : TOOLS.get(look.held);
  const body = seated(
    fabric !== undefined ? dyed(fabric, pose, compact) : compact ? mini(pose) : hero(pose),
    held,
    compact,
  );
  const effects = compact ? frame.layers.map(miniOf) : [...frame.layers];
  if (pose.mouth === "whistle" && PUCKER !== undefined)
    effects.push(compact ? miniOf(PUCKER) : PUCKER);
  const worn = frame.hidden
    ? []
    : probe.bare
      ? layersOf({ held: look.held }, compact, beat)
      : layersOf(look, compact, beat);
  // A Cell gone this frame keeps its anchors, so what the frame adds stands where it stood.
  const shown = frame.hidden
    ? { ...body, rows: body.rows.map((row) => ".".repeat(row.length)), front: [], features: [] }
    : body;
  const rows = compose(shown, [...worn, ...effects], probe.spill);
  return move.facing === "left" ? rows.map((row) => [...row].toReversed().join("")) : rows;
}

/** One frame at the miniature's size, with the hero art it stands for, at twice the density. */
export interface MiniFrame {
  readonly rows: readonly string[];
  readonly detail: readonly string[];
  /** The frame as a display draws it: both, with the margin past the box (`MARGIN`). */
  readonly drawn: { readonly rows: readonly string[]; readonly detail: readonly string[] };
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

/** Where the miniature's footprint lies on the hero's grid, cell for cell. */
const DETAIL = { x: 3, y: 2, width: 26, height: 28 } as const;

/** The hero art a miniature stands for: the hero cropped to the miniature's footprint. */
const detailOf = (hero: readonly string[]) =>
  crop(hero, DETAIL.x, DETAIL.y, DETAIL.width, DETAIL.height);

/**
 * How far a display draws a Cell past its box, in cells of the miniature: to
 * the hero grid's edges, rounded out to whole cells. The original's pieces,
 * drawn for its larger stage, reach there; the box still lays the Cell out.
 */
export const MARGIN = { x: 2, y: 1 } as const;

/** A frame with the margin: the miniature padded with nothing, the hero uncropped. */
const drawnOf = (rows: readonly string[], hero: readonly string[]): MiniFrame["drawn"] => ({
  rows: crop(
    rows,
    -MARGIN.x,
    -MARGIN.y,
    (rows[0]?.length ?? 0) + MARGIN.x * 2,
    rows.length + MARGIN.y * 2,
  ),
  detail: crop(
    hero,
    DETAIL.x - MARGIN.x * 2,
    DETAIL.y - MARGIN.y * 2,
    DETAIL.width + MARGIN.x * 4,
    DETAIL.height + MARGIN.y * 4,
  ),
});

/** A frame of a miniature and the hero it stands for; the margin's picture made the first time a display asks for it. */
function frameOf(rows: readonly string[], hero: readonly string[]): MiniFrame {
  let drawn: MiniFrame["drawn"] | undefined;
  return {
    rows,
    detail: detailOf(hero),
    get drawn() {
      return (drawn ??= drawnOf(rows, hero));
    },
  };
}

/** Cells of a hero frame past the miniature's footprint: the Cell's box. */
export const pastDetail = (hero: readonly string[]): number =>
  hero.reduce(
    (count, row, y) =>
      count +
      [...row].filter(
        (cell, x) =>
          cell !== "." &&
          (x < DETAIL.x ||
            x >= DETAIL.x + DETAIL.width ||
            y < DETAIL.y ||
            y >= DETAIL.y + DETAIL.height),
      ).length,
    0,
  );

/** The frames `move` shows worn in `wardrobe`: each one's pose and the clock its pieces read. */
function folding(move: Move, wardrobe: Wardrobe, pieces: "loop" | "once" | "still") {
  const moving = animatedOf(wardrobe);
  return moving.length === 0
    ? { fps: move.fps, poses: move.frames.map((_, i) => i), beats: move.frames.map(() => STILL) }
    : pieces === "still"
      ? fold(move.frames.length, onBeat(move.fps), [])
      : fold(move.frames.length, onBeat(move.fps), moving, pieces === "loop");
}

/** `move` worn: every frame at both sizes, open and shut, its animated pieces run as `pieces` says. */
function composed(move: Move, wardrobe: Wardrobe, pieces: "loop" | "once" | "still"): CellScene {
  const moving = animatedOf(wardrobe);
  const folded = folding(move, wardrobe, pieces);
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
    minis.map((rows, i) => frameOf(rows, heroes[i]!));
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

/** A look a Cell wears: its name (its scenes' identity), what it wears, whose cheer it plays, how strong it has grown, and what its landing changed. */
export interface CellLook {
  readonly name: string;
  readonly wardrobe: Wardrobe;
  readonly cheer?: string | undefined;
  readonly strength?: Strength | undefined;
  readonly diff?: Diff | undefined;
}

/** What a landing's run did to the lines of the files it changed. */
export interface Diff {
  readonly added: boolean;
  readonly removed: boolean;
}

/** The flex, the gym's cheer: a landing that earned it plays it in place of the look's own (`growth.ts`). */
export const FLEX = "gym/flex";

/** `look` on a Cell grown to `strength`, flexing for its cheer when `flexes`. */
export function grown(look: CellLook, strength: Strength | undefined, flexes = false): CellLook {
  if (strength === undefined && !flexes) return look;
  return {
    ...look,
    name: `${look.name}@${strength ?? ""}${flexes ? `:${FLEX}` : ""}`,
    cheer: flexes ? FLEX : look.cheer,
    strength,
  };
}

/** `look` cheering a landing whose run did `diff`: a `+` rises if it added lines, a `−` if it removed some. */
export function marked(look: CellLook, diff: Diff): CellLook {
  if (!diff.added && !diff.removed) return look;
  return {
    ...look,
    name: `${look.name}${diff.added ? "+" : ""}${diff.removed ? "−" : ""}`,
    diff,
  };
}

/** How far `pose` carries the ground from where it stands at rest. */
const carried = (body: (pose: Pose) => Body, pose: Pose): Point => {
  const at = anchorOf(body(pose), "ground");
  const home = anchorOf(body(REST), "ground");
  return { x: at.x - home.x, y: at.y - home.y };
};

/**
 * `move`, worn in `wardrobe`, with `diff`'s marks rising over its first
 * frames from the shoulder (`DIFF_MARKS`). They rise from the box, not the
 * body: each frame's hop and step, as its hat holds them, are taken back out.
 */
function withMarks(move: Move, diff: Diff | undefined, wardrobe: Wardrobe): Move {
  if (DIFF_MARKS === undefined || diff === undefined) return move;
  const marks = [
    ...(diff.added ? [DIFF_MARKS.added] : []),
    ...(diff.removed ? [DIFF_MARKS.removed] : []),
  ];
  const { rise } = DIFF_MARKS;
  const risen = (frame: Frame, up: number): Frame => {
    const look = swappedIn(frame, wardrobe);
    const pose = fitted(frame.pose, headroomOf(look), backroomOf(look));
    const big = carried(hero, pose);
    const small = carried(mini, pose);
    const raised = marks.map((mark): Layer => ({
      ...mark,
      hotspot: { x: mark.hotspot.x + big.x, y: mark.hotspot.y + up + big.y },
      miniHotspot:
        mark.miniHotspot === undefined
          ? undefined
          : {
              x: mark.miniHotspot.x + small.x,
              y: mark.miniHotspot.y + round(up / 2) + small.y,
            },
    }));
    return { ...frame, layers: [...frame.layers, ...raised] };
  };
  return {
    ...move,
    frames: move.frames.map((frame, i) => (i < rise.length ? risen(frame, rise[i]!) : frame)),
  };
}

/**
 * `move` played by a Cell grown to `strength`: in each frame, the strength's
 * arm on each side the frame leaves free and the tool in hand (`held`)
 * doesn't take; with biceps, every arm bulges. A frame of a move that
 * draws its own arms (the flex) plays as drawn where it draws them.
 */
function strong(move: Move, strength: Strength | undefined, held: string | undefined): Move {
  const rest = strength === undefined ? undefined : STRENGTH_ARMS.get(strength);
  if (rest === undefined) return move;
  const holding = held === undefined ? undefined : TOOLS.get(held)?.attach;
  const bulge = strength === "biceps" ? rest.bulge : undefined;
  return {
    ...move,
    frames: move.frames.map((frame) => {
      if (move.meta.ownArms && frame.layers.length > 0) return frame;
      const arms: Arm[] = frame.pose.arms.map((arm) => ({ ...arm, bulge }));
      for (const side of [-1, 1]) {
        const free = !arms.some((arm) => (arm.side < 0 ? -1 : 1) === side);
        if (free && holding !== (side < 0 ? "handL" : "handR")) arms.push({ ...rest, side });
      }
      return { ...frame, pose: { ...frame.pose, arms } };
    }),
  };
}

/** A curated look by name, with its own cheer when it has one. */
export function curated(name: string): CellLook | undefined {
  const look = LOOKS.find((l) => l.name === name);
  return look === undefined
    ? undefined
    : { name, wardrobe: look.wardrobe, cheer: CHEERS.has(name) ? name : undefined };
}

const SLOT_FIELD: Readonly<Record<Slot, "headwear" | "accessory" | "wrap" | "back">> = {
  headwear: "headwear",
  face: "accessory",
  wrap: "wrap",
  back: "back",
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
  const worn = (["headwear", "face", "wrap", "back"] as const).flatMap(
    (slot) => bySlot.get(slot) ?? [],
  );
  return { name: `pack:${worn.join("+")}`, wardrobe };
}

/** A pack's outfit (`theme/outfit`) as a look, in `colourway` when it names one of its own; undefined for none. */
export function outfitLook(id: string, colourway?: string): CellLook | undefined {
  const outfit = PACK_OUTFITS.get(id);
  if (outfit === undefined) return undefined;
  const dyed = outfit.colourways.find((c) => c.id === colourway);
  return {
    name: `outfit:${id}${dyed === undefined ? "" : `~${dyed.id}`}`,
    wardrobe: {
      outfit: outfit.outfit,
      headwear: outfit.headwear,
      accessory: outfit.face,
      wrap: outfit.wrap,
      back: outfit.back,
      fabric: dyed?.fabric ?? outfit.fabric,
    },
    cheer: outfit.cheer,
  };
}

/**
 * What a Cell was dealt (`looks.ts`) as one look: outfits
 * (`outfit:theme/outfit~colourway`) and pieces (`theme/piece`), each filling
 * the slots still free, the first-dealt first, and the first outfit's cheer.
 * Pieces alone are a pack look.
 */
export function wornLook(ids: readonly string[]): CellLook {
  if (!ids.some((id) => id.startsWith("outfit:"))) return packLook(ids);
  const wardrobe: { -readonly [K in keyof Wardrobe]: Wardrobe[K] } = {};
  let cheer: string | undefined;
  const worn: string[] = [];
  for (const id of ids) {
    if (id.startsWith("outfit:")) {
      const [outfit = "", colourway] = id.slice("outfit:".length).split("~");
      const look = outfitLook(outfit, colourway);
      if (look === undefined) continue;
      for (const [field, piece] of Object.entries(look.wardrobe) as [keyof Wardrobe, string][])
        if (piece !== undefined && wardrobe[field] === undefined) wardrobe[field] = piece;
      cheer ??= look.cheer;
    } else {
      const piece = pieceOf(id);
      if (piece === undefined) continue;
      const field = SLOT_FIELD[piece.slot];
      if (wardrobe[field] !== undefined) continue;
      wardrobe[field] = id;
    }
    worn.push(id);
  }
  return { name: `worn:${worn.join("+")}`, wardrobe, cheer };
}

/** `wardrobe` in the scenes of `state` (`building` for `building/0`): each pack piece that poses for it swapped for its variant. */
function posedIn(wardrobe: Wardrobe, state: string): Wardrobe {
  const posed = (id: string | undefined) => {
    const piece = id === undefined ? undefined : pieceOf(id);
    const variant = piece?.poses[state];
    return variant === undefined || piece === undefined ? id : `${piece.theme}/${variant}`;
  };
  return {
    ...wardrobe,
    headwear: posed(wardrobe.headwear),
    accessory: posed(wardrobe.accessory),
    wrap: posed(wardrobe.wrap),
    back: posed(wardrobe.back),
  };
}

const scenes = new Map<string, CellScene>();

/** What scene `key` plays in `look`: its move (the look's own cheer for `happy`), what it wears in that state, how its pieces run. */
function playOf(
  look: CellLook,
  key: string,
): { move: Move; wardrobe: Wardrobe; pieces: Scene["pieces"] } | undefined {
  const scene = SCENES.get(key);
  if (scene === undefined) return undefined;
  const cheer = key === "happy" && look.cheer !== undefined ? CHEERS.get(look.cheer) : undefined;
  const dressed = posedIn(look.wardrobe, key.split("/")[0]!);
  const wardrobe = scene.holds ? { ...dressed, held: scene.held } : dressed;
  const played = strong(cheer ?? scene, look.strength, wardrobe.held);
  return {
    move: key === "happy" ? withMarks(played, look.diff, wardrobe) : played,
    wardrobe,
    pieces: scene.pieces,
  };
}

/**
 * The scene `key` (`idle`, `reading/0`, … in `kit/moves.json`) in `look`,
 * composed the first time it is asked for: a Cell pays for the scenes it
 * shows, never for the catalogue. A look with a cheer of its own plays it
 * for `happy`.
 */
export function sceneOf(look: CellLook, key: string): CellScene | undefined {
  const known = scenes.get(`${look.name}|${key}`);
  if (known !== undefined) return known;
  const play = playOf(look, key);
  if (play === undefined) return undefined;
  const made = composed(play.move, play.wardrobe, play.pieces);
  scenes.set(`${look.name}|${key}`, made);
  return made;
}

/** `pose` held still in `look`, kept among its scenes as `name` (a name no scene in the kit has). */
export function stillOf(look: CellLook, name: string, pose: Pose): CellScene {
  const known = scenes.get(`${look.name}|${name}`);
  if (known !== undefined) return known;
  const still: Move = {
    fps: 0,
    facing: "right",
    frames: [{ pose, layers: [], swaps: {} }],
    meta: {},
  };
  const wardrobe = posedIn(look.wardrobe, name);
  const made = composed(strong(still, look.strength, wardrobe.held), wardrobe, "still");
  scenes.set(`${look.name}|${name}`, made);
  return made;
}

/** A frame as the tools measure it: worn, and the same pose bare, and bare with no eyes. */
export interface FrameProbe {
  readonly worn: readonly string[];
  readonly bare: readonly string[];
  readonly eyeless: readonly string[];
  /** The eyes the pose shows. */
  readonly eyes: string;
  /** Worn cells that fell off the grid. */
  readonly spilt: number;
  /**
   * Cells of the move's marks and the tool in hand that fell off the grid,
   * or, at the hero, past the miniature's footprint: the box, which art
   * drawn here keeps inside. The margin a display draws past it is for the
   * original's pieces, drawn for its larger stage.
   */
  readonly effects: number;
}

/** A frame measured: `frame` composed worn, bare and eyeless. */
function measured(frame: (probe: Probe) => string[], compact: boolean, eyes: string): FrameProbe {
  const worn = { count: 0 };
  const bare = { count: 0 };
  const wornRows = frame({ spill: worn });
  const bareRows = frame({ bare: true, spill: bare });
  const past = (rows: readonly string[]) => (compact ? 0 : pastDetail(rows));
  return {
    worn: wornRows,
    bare: bareRows,
    eyeless: frame({ bare: true, eyeless: true }),
    eyes,
    spilt: worn.count - bare.count,
    effects: bare.count + past(bareRows),
  };
}

/** `pose` held still in `look` as it rests (worn as for `idle`), at the miniature (`compact`) or the hero, as the tools measure it. */
export function probeStill(look: CellLook, pose: Pose, compact: boolean): FrameProbe {
  const still: Move = {
    fps: 0,
    facing: "right",
    frames: [{ pose, layers: [], swaps: {} }],
    meta: {},
  };
  const wardrobe = posedIn(look.wardrobe, "idle");
  const move = strong(still, look.strength, wardrobe.held);
  return measured(
    (probe) => composeFrame(move, 0, wardrobe, compact, false, STILL, probe),
    compact,
    pose.eyes,
  );
}

/** Every frame scene `key` shows in `look`, at the miniature (`compact`) or the hero, as the tools measure it. */
export function probesOf(look: CellLook, key: string, compact: boolean): FrameProbe[] {
  const play = playOf(look, key);
  if (play === undefined) return [];
  const { move, wardrobe } = play;
  const folded = folding(move, wardrobe, play.pieces);
  return folded.poses.map((index, i) =>
    measured(
      (probe) => composeFrame(move, index, wardrobe, compact, false, folded.beats[i]!, probe),
      compact,
      move.frames[index]!.pose.eyes,
    ),
  );
}
