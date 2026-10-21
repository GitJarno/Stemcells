// The rules a drawing must pass before it ships. The original's, ported
// (its pack test): known roles, inside the canvas, one eye left whole,
// nothing dark against the void, clothing clear of the mouth. Then
// Stemcells' own: every scene keeps the art on the canvas, the outline reads
// on the light frame after its keyline as on black, moves keep the beat and
// say what Reduce Motion holds, and a pack's outfits stay apart. On the
// original's art these are notes, never failures: it is the reference
// (`stemcells/docs/cell-art.md`).

import {
  BODY_ROLES,
  contrast,
  facesVoid,
  FRAMES,
  type Ground,
  keylined,
  MIN_CONTRAST,
} from "../keyline.ts";
import {
  ACCESSORIES,
  BODIES,
  CHEERS,
  DRAWN_SCENES,
  EXPORTED_SCENES,
  FABRICS,
  HEADWEAR,
  HERO,
  MINI,
  type Move,
  MOVE_FILES,
  OUTFITS,
  type PackData,
  PACK_FILES,
  PACKS,
  paletteOf,
  pieceOf,
  REST,
  SCENES,
  type Slot,
  TEMPERAMENTS,
} from "../kit.ts";
import {
  type CellLook,
  type FrameProbe,
  outfitLook,
  packLook,
  probesOf,
  probeStill,
} from "../scene.ts";

/** A failure stops the art shipping; a warning asks for a look; a note is about the original's art, the reference. */
export type Level = "fail" | "warn" | "note";

export interface Finding {
  readonly rule: string;
  readonly subject: string;
  readonly detail: string;
  readonly level: Level;
}

/** The scenes where the face carries the Cell's state: a piece posed for one of them must leave an eye. */
export const STATE_SCENES: readonly string[] = ["idle", "waiting", "happy", "asleep", "alert"];

/** The share of a piece's outline under `MIN_CONTRAST` that fails it. */
export const DIM_SHARE = 0.5;

/** The darkest a cell beside empty space may be on black: Rec. 601 luma, 0–255. */
export const MIN_LUMA = 40;

/** The original's mouth zone: under the eyes, where a stamp reads as a mouth or a moustache. */
const MOUTH_ZONE = {
  hero: { rows: [19, 23], columns: [11, 20] },
  mini: { rows: [9, 11], columns: [4, 8] },
} as const;

const BEAT = 12;
const SOUND_BEAT = 24;

const PALETTE = paletteOf("claude");

type Cell = readonly [x: number, y: number];

/** Cells where `a` and `b` differ. */
function differing(a: readonly string[], b: readonly string[]): Cell[] {
  const out: Cell[] = [];
  a.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== b[y]?.[x]) out.push([x, y]);
  });
  return out;
}

/** Whether what a look wears changes a cell of each eye (`E`) the bare face draws. */
function coversBothEyes(probe: FrameProbe, compact: boolean): boolean {
  const middle = (compact ? MINI : HERO).anchors.eyes?.x ?? 0;
  const covered = { left: false, right: false };
  for (const [x, y] of differing(probe.bare, probe.eyeless)) {
    if (probe.bare[y]?.[x] !== "E" || probe.worn[y]?.[x] === "E") continue;
    if (x <= middle) covered.left = true;
    else covered.right = true;
  }
  return covered.left && covered.right;
}

/** Rec. 601 luma of a role, 0–255; a body role at its darkest provider. */
function luma(role: string): number {
  const inks = Object.keys(BODIES).flatMap((body) => paletteOf(body)[role] ?? []);
  return Math.min(
    ...inks.map((ink) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(ink.slice(i, i + 2), 16));
      return 0.299 * r! + 0.587 * g! + 0.114 * b!;
    }),
  );
}

/** The cells what a look wears put on the frame (the body's own roles aside). */
function pieceCells(rows: readonly string[], bare: readonly string[]): Cell[] {
  return differing(rows, bare).filter(([x, y]) => {
    const cell = rows[y]?.[x] ?? ".";
    return cell !== "." && !BODY_ROLES.has(cell);
  });
}

/** The share of a frame's piece outline too dim to read on `ground`, light frames keylined first; undefined with no outline. */
export function dimShare(probe: FrameProbe, ground: Ground): number | undefined {
  const rows = ground === "light" ? keylined(probe.worn, PALETTE) : probe.worn;
  const outline = pieceCells(rows, probe.bare).filter(([x, y]) => facesVoid(rows, x, y));
  if (outline.length === 0) return undefined;
  const dim = outline.filter(([x, y]) => {
    const ink = PALETTE[rows[y]![x]!];
    return ink === undefined || contrast(ink, FRAMES[ground]) < MIN_CONTRAST;
  });
  return dim.length / outline.length;
}

/** The fabric roles a look's dye may put anywhere, the mouth zone too. */
function fabricRoles(look: CellLook): Set<string> {
  const fabric = look.wardrobe.fabric === undefined ? undefined : FABRICS.get(look.wardrobe.fabric);
  return new Set((fabric ?? []).flatMap((band) => Object.values(band.map)));
}

/**
 * What a look breaks at rest (the original's rules, at both sizes) and in
 * any scene (art falling off the canvas, a warning: the original's own hats
 * do in the plea's hop). `mouth` holds a piece to the mouth zone (headwear
 * and back pieces: a face piece is the face's own, a wrap is the Cell's
 * trousers); `eyesAllowed` frees a variant posed only for work.
 */
function lookFindings(
  subject: string,
  look: CellLook,
  options: {
    original: boolean;
    mouth: boolean;
    eyesAllowed: boolean;
    scenes?: readonly string[] | undefined;
  },
): Finding[] {
  const out: Finding[] = [];
  const say = (rule: string, detail: string, level: Level = "fail") =>
    out.push({ rule, subject, detail, level: options.original ? "note" : level });
  for (const compact of [false, true]) {
    const size = compact ? "mini" : "hero";
    for (const eyes of ["calm", "open"]) {
      const probe = probeStill(look, { ...REST, eyes }, compact);
      if (probe.spilt > 0) say("box", `${size} at rest: ${probe.spilt} cells off the canvas`);
      if (!options.eyesAllowed && coversBothEyes(probe, compact))
        say("eyes", `${size}: covers both eyes (${eyes})`);
      if (eyes !== "calm") continue;
      const dark = new Set(
        pieceCells(probe.worn, probe.bare)
          .filter(([x, y]) => facesVoid(probe.worn, x, y))
          .map(([x, y]) => probe.worn[y]![x]!)
          .filter((role) => luma(role) < MIN_LUMA),
      );
      if (dark.size > 0) say("void", `${size}: dark against the void (${[...dark].join(" ")})`);
      if (options.mouth) {
        const zone = MOUTH_ZONE[size];
        const fabrics = fabricRoles(look);
        const stamped = differing(probe.worn, probe.bare).filter(
          ([x, y]) =>
            y >= zone.rows[0] &&
            y <= zone.rows[1] &&
            x >= zone.columns[0] &&
            x <= zone.columns[1] &&
            !fabrics.has(probe.worn[y]![x]!),
        );
        if (stamped.length > 0)
          say("mouth", `${size}: ${stamped.length} cells stamped under the eyes`);
      }
      for (const ground of ["black", "light"] as const) {
        const share = dimShare(probe, ground);
        if (share !== undefined && share >= DIM_SHARE)
          say(
            "contrast",
            `${size} on ${ground}: ${Math.round(share * 100)} % of its outline under ${MIN_CONTRAST} : 1`,
          );
      }
    }
    const spilt = (options.scenes ?? [...SCENES.keys()]).filter((key) =>
      probesOf(look, key, compact).some((probe) => probe.spilt > 0),
    );
    if (spilt.length > 0)
      say("box", `${size}: art falls off the canvas in ${spilt.join(", ")}`, "warn");
  }
  return out;
}

const MONTH_DAY = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** What pack file `file` breaks in its data: its theme, references, frames, seasons, outfits kept apart. */
export function packDataFindings(file: string, pack: PackData): Finding[] {
  const out: Finding[] = [];
  const say = (rule: string, subject: string, detail: string) =>
    out.push({ rule, subject, detail, level: "fail" });
  const theme = pack.theme;
  if (theme !== file) say("theme", theme, `the file is ${file}.json: name it ${theme}.json`);
  if (PACKS.some((other) => other.theme === theme && !other.authored))
    say("theme", theme, "the original has a pack of this name, which wins");
  const names = new Set(pack.pieces.map((piece) => piece.name));
  for (const piece of pack.pieces) {
    const id = `${theme}/${piece.name}`;
    if (!["headwear", "face", "wrap", "back"].includes(piece.slot))
      say("slot", id, `no slot "${piece.slot}"`);
    const heroes = piece.frames ?? [piece.art];
    const minis = piece.miniFrames ?? [piece.mini];
    if (heroes.length !== minis.length)
      say("frames", id, `${heroes.length} hero frames, ${minis.length} miniature`);
    if (heroes.length > 1 && !(piece.fps !== undefined && piece.fps > 0 && BEAT % piece.fps === 0))
      say("beat", id, `fps ${piece.fps ?? "none"} doesn't divide ${BEAT}`);
    const letters = new Set([...heroes, ...minis].flat().join(""));
    for (const letter of letters)
      if (letter !== "." && PALETTE[letter] === undefined)
        say("letters", id, `"${letter}" has no colour`);
    for (const [state, variant] of Object.entries(piece.poses ?? {}))
      if (!names.has(variant)) say("poses", id, `${state} → "${variant}" is no piece of ${theme}`);
  }
  const fabrics = new Set(Object.keys(pack.fabrics ?? {}).map((name) => `${theme}/${name}`));
  const cheers = new Set(Object.keys(pack.cheers ?? {}).map((name) => `${theme}/${name}`));
  const seen = new Map<string, string>();
  for (const outfit of pack.outfits ?? []) {
    const id = `${theme}/${outfit.id}`;
    for (const slot of ["headwear", "face", "wrap", "back"] as const) {
      const worn = outfit[slot];
      const library = slot === "headwear" ? HEADWEAR : slot === "face" ? ACCESSORIES : undefined;
      if (worn !== undefined && pieceOf(worn, slot as Slot) === undefined && !library?.has(worn))
        say("outfits", id, `${slot} "${worn}" is no ${slot} piece`);
    }
    if (outfit.outfit !== undefined && !OUTFITS.has(outfit.outfit))
      say("outfits", id, `"${outfit.outfit}" is no outfit of the original's`);
    for (const fabric of [outfit.fabric, ...(outfit.colourways ?? []).map((c) => c.fabric)])
      if (fabric !== undefined && !fabrics.has(fabric) && !FABRICS.has(fabric))
        say("outfits", id, `fabric "${fabric}" is no fabric`);
    if (outfit.cheer !== undefined && !cheers.has(outfit.cheer) && !CHEERS.has(outfit.cheer))
      say("outfits", id, `cheer "${outfit.cheer}" is no cheer`);
    const kind = `${outfit.silhouette} / ${outfit.family}`;
    const twin = seen.get(kind);
    if (twin !== undefined) say("apart", id, `same silhouette and family as ${twin} (${kind})`);
    seen.set(kind, id);
  }
  for (const name of Object.keys(pack.cheers ?? {})) {
    const cheer = CHEERS.get(`${theme}/${name}`);
    if (cheer !== undefined) out.push(...moveFindings(`${theme}/${name}`, cheer, true));
  }
  const season = pack.season;
  if (season !== null) {
    const windows = "years" in season ? Object.values(season.years) : [[season.from, season.to]];
    if ("years" in season)
      for (const year of Object.keys(season.years))
        if (!/^\d{4}$/.test(year)) say("season", theme, `"${year}" is no year`);
    for (const [from, to] of windows)
      if (!MONTH_DAY.test(from ?? "") || !MONTH_DAY.test(to ?? ""))
        say("season", theme, `"${from}" to "${to}" is no window (MM-DD)`);
  }
  return out;
}

/** What a move breaks in its timing and meta; `drawn` for one drawn for Stemcells. */
function moveFindings(subject: string, move: Move, drawn: boolean): Finding[] {
  const out: Finding[] = [];
  const say = (rule: string, detail: string) =>
    out.push({ rule, subject, detail, level: drawn ? "fail" : "note" });
  const meta = move.meta;
  const beat = meta.sound ? SOUND_BEAT : BEAT;
  if (move.frames.length > 1 && !(move.fps > 0 && beat % move.fps === 0))
    say("beat", `fps ${move.fps} doesn't divide ${beat}`);
  if (drawn) {
    if (meta.tell === undefined) say("tell", "no tell: the frame Reduce Motion holds");
    else if (!(meta.tell >= 0 && meta.tell < move.frames.length))
      say("tell", `tell ${meta.tell} is no frame`);
    if (meta.next !== undefined && !SCENES.has(meta.next))
      say("next", `hands back to "${meta.next}", no scene`);
  }
  return out;
}

/** A look a pack's art makes: a piece worn alone, or an outfit in a colourway. */
export interface PackLook {
  readonly label: string;
  readonly kind: "piece" | "outfit";
  readonly look: CellLook;
  /** Held to the mouth zone: a headwear or back piece worn alone. */
  readonly mouth: boolean;
  /** A posed variant worn only at work, when the face carries no state: it may cover both eyes. */
  readonly eyesAllowed: boolean;
  /** The scenes a posed variant is worn in; every scene for anything else. */
  readonly scenes?: readonly string[] | undefined;
}

/** Every look a pack's art makes: each piece worn alone (its posed variants too), and each outfit in each colourway. */
export function looksOfPack(theme: string): PackLook[] {
  const pack = PACKS.find((p) => p.theme === theme);
  if (pack === undefined) return [];
  const statesOf = (name: string) =>
    pack.pieces.flatMap((piece) =>
      Object.entries(piece.poses)
        .filter(([, variant]) => variant === name)
        .map(([state]) => state),
    );
  // A cheer swaps a piece in for `happy`, the state a cheer plays for.
  const swappedIn = new Set(
    [...CHEERS.values()].flatMap((cheer) =>
      cheer.frames.flatMap((frame) => Object.values(frame.swaps)),
    ),
  );
  const scenesOf = (name: string) => {
    const states = new Set(statesOf(name));
    if (swappedIn.has(`${theme}/${name}`)) states.add("happy");
    return [...SCENES.keys()].filter((key) => states.has(key.split("/")[0]!));
  };
  const pieces = pack.pieces.map((piece): PackLook => {
    const id = `${theme}/${piece.name}`;
    return {
      label: id,
      kind: "piece",
      look: packLook([id]),
      mouth: piece.slot === "headwear" || piece.slot === "back",
      eyesAllowed: piece.posed && !statesOf(piece.name).some((s) => STATE_SCENES.includes(s)),
      scenes: piece.posed ? scenesOf(piece.name) : undefined,
    };
  });
  const outfits = pack.outfits.flatMap((outfit) => {
    const id = `${theme}/${outfit.name}`;
    return [undefined, ...outfit.colourways.map((c) => c.id)].flatMap((colourway): PackLook[] => {
      const look = outfitLook(id, colourway);
      return look === undefined
        ? []
        : [
            {
              label: colourway ? `${id}~${colourway}` : `outfit ${id}`,
              kind: "outfit",
              look,
              mouth: false,
              eyesAllowed: false,
            },
          ];
    });
  });
  return [...pieces, ...outfits];
}

/** What a temperament breaks: its beats and fidget name scenes that exist. */
function temperamentFindings(): Finding[] {
  const out: Finding[] = [];
  for (const t of TEMPERAMENTS.values()) {
    const say = (rule: string, detail: string) =>
      out.push({ rule, subject: `temperament ${t.id}`, detail, level: "fail" });
    if (!(t.weight > 0)) say("temperament", "weight must be above 0");
    for (const name of [t.fidget, ...Object.values(t.beats ?? {})])
      if (!SCENES.has(name)) say("temperament", `"${name}" is no scene`);
  }
  return out;
}

/** What a drawn scene's marks and tools break: falling off the canvas, a warning (a move that travels leaves its box on purpose). */
function sceneFindings(key: string): Finding[] {
  const sizes = (["hero", "mini"] as const).filter((size) =>
    probesOf(packLook([]), key, size === "mini").some((probe) => probe.effects > 0),
  );
  return sizes.length === 0
    ? []
    : [
        {
          rule: "box",
          subject: key,
          detail: `its marks fall off the canvas (${sizes.join(", ")})`,
          level: "warn",
        },
      ];
}

/** Findings of one rule on one subject folded into one, counting the rest. */
function folded(findings: readonly Finding[]): Finding[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    const key = `${f.level}|${f.rule}|${f.subject}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0]!;
    return group.length === 1
      ? first
      : { ...first, detail: `${first.detail} (and ${group.length - 1} more)` };
  });
}

/**
 * Every finding over the art drawn for Stemcells (or the packs in `themes`),
 * and with `original`, over the export's too, as notes.
 */
export function check(options: { themes?: readonly string[]; original?: boolean } = {}): Finding[] {
  const wanted = (theme: string) =>
    options.themes === undefined || options.themes.length === 0 || options.themes.includes(theme);
  const out: Finding[] = [];
  for (const [file, pack] of PACK_FILES)
    if (wanted(pack.theme)) out.push(...packDataFindings(file, pack));
  for (const [file, moves] of MOVE_FILES)
    for (const name of Object.keys(moves.scenes ?? {})) {
      if (EXPORTED_SCENES.has(name))
        out.push({
          rule: "scene",
          subject: `${file}: ${name}`,
          detail: "the original has a scene of this name, which wins: add to it through `meta`",
          level: "fail",
        });
      const move = DRAWN_SCENES.get(name);
      if (move !== undefined)
        out.push(...moveFindings(`${file}: ${name}`, move, true), ...sceneFindings(name));
    }
  out.push(...temperamentFindings());
  for (const pack of PACKS) {
    if (!wanted(pack.theme) || (!pack.authored && !options.original)) continue;
    for (const { label, look, mouth, eyesAllowed, scenes } of looksOfPack(pack.theme))
      out.push(
        ...lookFindings(label, look, { original: !pack.authored, mouth, eyesAllowed, scenes }),
      );
  }
  return folded(out);
}
