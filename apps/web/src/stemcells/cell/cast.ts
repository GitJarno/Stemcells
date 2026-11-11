// What a Cell plays for its mood, in whose colours, and which picture it
// shows at a moment: the original app's casting over the kit's scenes, each
// Cell in its own manner (`manner.ts`), a moment played once from where it began.

import type { Activity } from "./activity.ts";
import { isBlinking } from "./blink.ts";
import { type Pose, REST, type Temperament } from "./kit.ts";
import type { Mood } from "./look.ts";
import { fidgetingFor, mannerOf, phaseOf, pleasedKey, restKey } from "./manner.ts";
import {
  type CellLook,
  type CellScene,
  type MiniFrame,
  onBeat,
  sceneOf,
  stillOf,
} from "./scene.ts";

/** The body a provider's Cells wear (`kit/palette.json`): Codex, Kimi and Gemini their own, every other the coral Cell. */
export function bodyOf(provider: string | null | undefined): string {
  switch (provider) {
    case "codex":
    case "openai":
    case "gpt":
      return "codex";
    case "kimi":
    case "moonshot":
      return "kimi";
    case "gemini":
    case "google":
      return "gemini";
    default:
      return "claude";
  }
}

/** The faces a mood holds still: dazed once its run failed (`x x`), hunkered down braced (`> <`). */
const HELD: Partial<Readonly<Record<Mood, Pose>>> = {
  crashed: { ...REST, eyes: "dizzy", mouth: "wavy" },
  braced: { ...REST, sy: 0.86, spread: 0.6, eyes: "squeeze" },
};

/** A long think shows the calm ponder and the head scratch in turn, this long each. */
const PONDER_SECONDS = 20;

/** The scene in the kit a mood plays: at work, what it is doing, else listening; the pleas, the peer, asleep, the cheer. */
function sceneKey(mood: Mood, activity: Activity | undefined, seconds: number): string {
  switch (mood) {
    case "needsYou":
      return "waiting";
    case "needsApproval":
      // The original's act for a pending permission, as a question has `waiting`.
      return "alert";
    case "peering":
      return "peering";
    case "asleep":
      return "asleep";
    case "pleased":
      return "happy";
    case "meditating":
      // Floating over its shadow; held still with no clock, it sits on it.
      return seconds === 0 ? "meditating/still" : "meditating";
    default:
      if (activity === undefined) return "idle";
      return activity === "thinking"
        ? `thinking/${Math.floor(seconds / PONDER_SECONDS) & 1}`
        : `${activity}/0`;
  }
}

/** What a Cell in `look` plays in `mood` doing `activity`, at `seconds` (`clockSeconds`; 0 held still). */
export function sceneFor(
  look: CellLook,
  mood: Mood,
  activity: Activity | undefined,
  seconds: number,
): CellScene {
  const held = HELD[mood];
  if (held !== undefined) return stillOf(look, `held:${mood}`, held);
  return sceneOf(look, sceneKey(mood, activity, seconds)) ?? sceneOf(look, "idle")!;
}

/**
 * The miniature `scene` shows at `seconds` on the clock, its eyes shut while
 * the Cell `seed` names blinks (`pleading`, on the caret's beat); with no
 * time, held still: its first frame, eyes open.
 */
export function frameShown(
  scene: CellScene,
  seed: string,
  seconds: number | undefined,
  pleading: boolean,
): MiniFrame {
  if (seconds === undefined) return scene.mini[0]!;
  const frames =
    scene.shut !== undefined && isBlinking(seed, seconds, pleading) ? scene.shut.mini : scene.mini;
  return frames[Math.trunc(seconds * onBeat(scene.fps)) % frames.length]!;
}

/** A moment a Cell enters its state with: a move played once from `since` (on `clockSeconds`), before the state's own scene. */
export interface Entrance {
  readonly kind: "landed" | "onIt" | "wake" | "sleep";
  readonly since: number;
}

/** Where a Cell stands: its mood, and whether it is at work. */
export interface Stance {
  readonly mood: Mood;
  readonly working: boolean;
}

/** A landing found this long after it happened, in seconds, is joined in progress, not played again. */
const JOINED_LATE = 1.5;

/**
 * The moment a Cell enters `after` with, coming from `before` (undefined: it is first seen) at
 * `seconds`. A landing cheers, from the top for a picture that watched it land; one that finds
 * it landed (`landed`, its time on the clock) joins the cheer where it is by now. A send is
 * taken up; a sleeper wakes; a Cell going cold yawns. Nothing else is a moment.
 */
export function entranceOf(
  before: Stance | undefined,
  after: Stance,
  seconds: number,
  landed?: number,
): Entrance | undefined {
  if (after.mood === "pleased") {
    if (before?.mood === "pleased") return undefined;
    const found = before === undefined && landed !== undefined && seconds - landed > JOINED_LATE;
    return { kind: "landed", since: found ? landed : seconds };
  }
  if (before === undefined) return undefined;
  if (after.mood === "asleep")
    return before.mood === "asleep" ? undefined : { kind: "sleep", since: seconds };
  if (after.mood !== "awake") return undefined;
  if (before.mood === "asleep") return { kind: "wake", since: seconds };
  // Deep in thought, or behind a line that dropped, it was at work all along.
  const wasAtWork = before.working && ["awake", "meditating", "peering"].includes(before.mood);
  return after.working && !wasAtWork ? { kind: "onIt", since: seconds } : undefined;
}

const entered = new Map<string, Entrance>();

/**
 * The entrance a picture of the Cell `name` names takes up on coming to `after` from `before`
 * (undefined: the picture is new); undefined when nothing begins, and it keeps the one it had.
 * Every picture of a Cell plays a moment in step: the first to see it sets when it began, and
 * one that appears while the Cell still stands in it joins it.
 */
export function entering(
  name: string,
  before: Stance | undefined,
  after: Stance,
  seconds: number,
  landed?: number,
): Entrance | undefined {
  const moment = entranceOf(before, after, seconds, landed);
  const known = entered.get(name);
  if (known !== undefined && holds(known.kind, after)) {
    if (moment === undefined) return before === undefined ? known : undefined;
    if (moment.kind === known.kind && Math.abs(known.since - moment.since) <= JOINED_LATE)
      return known;
  }
  if (moment !== undefined) entered.set(name, moment);
  return moment;
}

/** Whether a Cell standing so is still in the state `kind` entered. */
function holds(kind: Entrance["kind"], { mood, working }: Stance): boolean {
  switch (kind) {
    case "landed":
      return mood === "pleased";
    case "onIt":
      return mood === "awake" && working;
    case "wake":
      return mood === "awake";
    case "sleep":
      return mood === "asleep";
  }
}

/** The scene an entrance plays: a landing's cheer (the look's own wins), else the manner's take, where it has one. */
function entranceKey(
  kind: Entrance["kind"],
  look: CellLook,
  manner: Temperament,
): string | undefined {
  if (kind === "landed")
    return look.cheer === undefined ? (manner.beats.landed ?? "happy") : "happy";
  return manner.beats[kind];
}

/** What a picture of a Cell needs to know to draw it at a moment. */
export interface Showing {
  /** What it is called: its manner, its blinks, its place in its loops. */
  readonly name: string;
  readonly mood: Mood;
  readonly activity: Activity | undefined;
  readonly entrance?: Entrance | undefined;
  /** The person is at the screen: a Cell at rest may fidget. */
  readonly here?: boolean | undefined;
}

/** The scene a Cell holds in its state, once any entrance has played: its own rest, its own way of waiting on you. */
function standing(look: CellLook, showing: Showing, manner: Temperament, seconds: number) {
  const { mood, activity } = showing;
  const key =
    mood === "pleased"
      ? pleasedKey(manner)
      : mood === "awake" && activity === undefined
        ? restKey(manner)
        : mood === "needsYou"
          ? manner.beats.needsYou
          : undefined;
  return (
    (key === undefined ? undefined : sceneOf(look, key)) ?? sceneFor(look, mood, activity, seconds)
  );
}

/** Composes every scene a Cell standing so can show, for a screen that composes ahead of drawing (the phone). */
export function prepare(look: CellLook, showing: Showing): void {
  const manner = mannerOf(showing.name);
  const stance = { mood: showing.mood, working: showing.activity !== undefined };
  standing(look, showing, manner, 0);
  for (const kind of ["landed", "onIt", "wake", "sleep"] as const) {
    const key = holds(kind, stance) ? entranceKey(kind, look, manner) : undefined;
    if (key !== undefined) sceneOf(look, key);
  }
}

/**
 * The miniature a Cell in `look` shows at `seconds` on the clock: its entrance played once from
 * where it began (held on its first frame while the Cell notices), then its state's scene, its
 * rest on its own phase with a fidget now and then, its eyes shut on its own blink. With no
 * time (Reduce Motion), the telling frame: a landing's cheer's, else its state's.
 */
export function frameFor(look: CellLook, showing: Showing, seconds: number | undefined): MiniFrame {
  const { name, mood, activity } = showing;
  const manner = mannerOf(name);
  const stance = { mood, working: activity !== undefined };
  const entrance =
    showing.entrance !== undefined && holds(showing.entrance.kind, stance)
      ? showing.entrance
      : undefined;
  const entryKey = entrance === undefined ? undefined : entranceKey(entrance.kind, look, manner);
  const entering =
    HELD[mood] !== undefined || entryKey === undefined ? undefined : sceneOf(look, entryKey);
  const state = standing(look, showing, manner, seconds ?? 0);
  if (seconds === undefined) {
    const told = entrance?.kind === "landed" && entering !== undefined ? entering : state;
    return told.mini[told.tell]!;
  }
  const pleading = mood === "needsYou" || mood === "needsApproval";
  const blinking = isBlinking(name, seconds, pleading, manner.blink);
  const at = (scene: CellScene, index: number) =>
    ((blinking ? scene.shut?.mini : undefined) ?? scene.mini)[index]!;
  if (entering !== undefined && entrance !== undefined) {
    const since = seconds - entrance.since - manner.noticeMs / 1000;
    const index = Math.trunc(since * onBeat(entering.fps));
    if (index < entering.pass) return at(entering, Math.max(0, index));
  }
  const resting = mood === "awake" && activity === undefined;
  if (resting && showing.here === true && manner.fidget !== undefined) {
    const fidget = sceneOf(look, manner.fidget);
    const since = fidgetingFor(name, seconds);
    if (fidget !== undefined && since !== undefined) {
      const index = Math.trunc(since * onBeat(fidget.fps));
      if (index < fidget.pass) return at(fidget, index);
    }
  }
  // Its own place in a loop while it rests or sleeps; in step with the rest while it works or asks.
  const own = resting || mood === "pleased" || mood === "asleep" ? phaseOf(name) : 0;
  return at(state, Math.trunc((seconds + own) * onBeat(state.fps)) % state.mini.length);
}

/**
 * The picture a miniature draws at `points` CSS pixels a cell on a display
 * of `dpr` device pixels a CSS pixel: its hero art at twice the density
 * wherever half a cell is whole device pixels (a 2× display, at 1 or 2
 * points), else the miniature itself; either with the margin past the box.
 */
export function pictureOf(
  frame: MiniFrame,
  points: number,
  dpr: number,
): { readonly rows: readonly string[]; readonly density: 1 | 2 } {
  const pixels = (points / 2) * dpr;
  return pixels >= 1 && Math.abs(pixels - Math.round(pixels)) < 0.001
    ? { rows: frame.drawn.detail, density: 2 }
    : { rows: frame.drawn.rows, density: 1 };
}
