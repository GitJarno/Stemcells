// A thrown Cell as it looks at each moment: the original's soft Cell in a world of its own. It
// never tumbles; an off-centre throw rolls its face round. Its body is springs a hit sets going
// (height, width, crown lean, hat lag), its face what the body goes through. The carry engine
// owns the flight and its facts (`Toss`); this only draws them (`stemcells/tasks/cell-toss.md`).

import { type Pose, REST } from "./kit.ts";
import { BOX, POINTS_PER_PIXEL } from "./look.ts";
import { type CellLook, DETAIL, frameIn, type MiniFrame, onBeat, sceneOf } from "./scene.ts";
import { round } from "./sprite.ts";

/** What it hit: a side of the chat, its top, or the floor it lands on. */
export type Surface = "left" | "right" | "ceiling" | "floor";

/** A contact as the engine felt it. */
export interface Hit {
  readonly surface: Surface;
  /** How fast it met the surface, CSS px a second, into it. */
  readonly speed: number;
  /** Its speed along the surface then, CSS px a second, right positive: a landing's skid. */
  readonly along?: number | undefined;
  /** When, `performance.now()` ms. */
  readonly at: number;
}

/** The flight's facts at a moment, as the carry engine knows them. */
export interface Toss {
  /** In the hand. */
  readonly held: boolean;
  /** Its velocity, CSS px a second, y down. */
  readonly vx: number;
  readonly vy: number;
  /** Down on the floor, sliding or still. */
  readonly grounded: boolean;
  /** The face's roll from an off-centre throw, radians; 0 faces front. */
  readonly roll?: number | undefined;
  /** The flight's hits so far, oldest first; a catch starts a new flight. */
  readonly hits?: readonly Hit[] | undefined;
  /** Its dizzy beat, from when it began (`performance.now()` ms) until the walk home. */
  readonly dizzyFrom?: number | undefined;
  /**
   * Walking home: since when (`performance.now()` ms), which way, and how
   * many times its home pace (1 unless a long way quickens it: its scoot's
   * beat quickens with it, so each step covers the same ground).
   */
  readonly walking?:
    | { readonly from: number; readonly toward: -1 | 1; readonly rate?: number | undefined }
    | undefined;
}

/** The scoot it walks home with, facing left (`art/moves/toss.json`). */
export const WALK = "toss/walk";

/**
 * How far it walks home a second, in its box's widths: the original's walk
 * home, at twice its stroll of two body widths.
 */
export const HOME_PACE = 4;

// The original's world, whose springs and faces this is: its fall, its
// clock, its ground's grip, and its body's springs (stiffness k, damping c,
// in the world's px and seconds).
const WORLD_GRAVITY = 430;
const WORLD_FPS = 24;
const GRIP = 300;
const SQUASH = { k: 330, c: 11 };
const BULGE = { k: 260, c: 10 };
const LEAN = { k: 150, c: 8 };
const HAT = { k: 90, c: 6 };

/** A toss falls this fast, CSS px a second², whatever the Cell's size: the original's. */
export const TOSS_GRAVITY = 1400;

/** Hanging from the hand, stretched this much. */
const HANGING = 1.08;

/** World seconds after a hit when every spring it kicked has settled under a pixel. */
const SETTLED = 2;

/**
 * The world the Cell flies in at `points` CSS px a cell: CSS px a world px
 * (the body's 26 px across its box), and world seconds a second, so it
 * falls as a toss does at that size.
 */
function worldAt(points: number): { readonly unit: number; readonly pace: number } {
  const unit = (BOX.width * points) / DETAIL.width;
  return { unit, pace: Math.sqrt(TOSS_GRAVITY / (WORLD_GRAVITY * unit)) };
}

/** Where a spring kicked to speed `v` at rest stands `t` world seconds on. */
function kicked(spring: { readonly k: number; readonly c: number }, v: number, t: number): number {
  const decay = spring.c / 2;
  const ring = Math.sqrt(spring.k - decay * decay);
  return (v * Math.exp(-decay * t) * Math.sin(ring * t)) / ring;
}

/** What a hit at world speed `v` (and `along` it) gives each spring, and how many world frames it hurts. */
function kicksOf(surface: Surface, v: number, along: number) {
  switch (surface) {
    // A side hit flattens it the other way, throws its crown off the wall,
    // and the hat lags.
    case "left":
    case "right": {
      const away = surface === "left" ? 1 : -1;
      return {
        squash: v * 0.006,
        bulge: -v * 0.06,
        lean: away * v * 0.08,
        hat: -away * v * 0.4725,
        ouch: Math.trunc(v / 50),
      };
    }
    // The chat's top presses it down.
    case "ceiling":
      return { squash: -v * 0.006, bulge: 0, lean: 0, hat: 0, ouch: Math.trunc(v / 50) };
    // The pancake, and the skid tips it.
    case "floor":
      return {
        squash: -v * 0.0125,
        bulge: 0,
        lean: along * 0.15,
        hat: 0,
        ouch: Math.trunc(v / 45),
      };
  }
}

/** The volume-keeping width at height `sy`. */
const keptWidth = (sy: number) => Math.max(sy, 0.3) ** -0.75;

/** `value` to the nearest `step`, as the original draws a pose: whole frames, no half-pixel variants (and never −0). */
const toStep = (value: number, step = 1) => round(value / step) * step + 0;

/**
 * The Cell's pose at `now` (`performance.now()` ms) in flight, drawn
 * `points` CSS px a cell. `steady` (Reduce Motion) keeps the body still:
 * only its face and its place move.
 */
export function tossPose(toss: Toss, now: number, points = POINTS_PER_PIXEL, steady = false): Pose {
  const { unit, pace } = worldAt(points);
  const world = (v: number) => v / (unit * pace);
  const vx = world(toss.vx);
  const vy = world(toss.vy);
  // What the springs settle to now: stretched along a fall, leaning into
  // its flight with the hat trailing; on the ground, tipped over its
  // braking.
  const braking = toss.grounded && vx !== 0 ? -Math.sign(vx) * GRIP : 0;
  let sy = toss.held ? HANGING : toss.grounded ? 1 : 1 + Math.min(0.3, Math.abs(vy) * 0.00065);
  let bulge = 0;
  let lean = toss.held ? 0 : toss.grounded ? -braking * 0.011 : vx * 0.012;
  let hat = toss.held ? 0 : toss.grounded ? -braking * 0.008 : -vx * 0.012;
  let hurts = false;
  for (const hit of toss.hits ?? []) {
    const t = ((now - hit.at) / 1000) * pace;
    if (t < 0 || t > SETTLED) continue;
    const kick = kicksOf(hit.surface, world(hit.speed), world(hit.along ?? 0));
    sy += kicked(SQUASH, kick.squash, t);
    bulge += kicked(BULGE, kick.bulge, t);
    lean += kicked(LEAN, kick.lean, t);
    hat += kicked(HAT, kick.hat, t);
    if (t * WORLD_FPS < kick.ouch) hurts = true;
  }
  if (steady) [sy, bulge, lean, hat] = [1, 0, 0, 0];
  // Its face: what the body goes through, a hit braced `> <`; in the hand
  // braced with an `o`; dizzy over everything.
  let [eyes, mouth] = hurts
    ? ["squeeze", "none"]
    : !toss.grounded && vy > 140
      ? ["squeeze", "open"]
      : !toss.grounded && vy < -40
        ? ["happy", "smile"]
        : toss.grounded && Math.abs(vx) > 50
          ? ["happy", "grin"]
          : [REST.eyes, REST.mouth];
  const roll = toss.roll ?? 0;
  if (Math.cos(roll) < 0) [eyes, mouth] = ["none", "none"];
  if (toss.held) [eyes, mouth] = ["squeeze", "open"];
  if (toss.dizzyFrom !== undefined) [eyes, mouth] = ["dizzy", "wavy"];
  return {
    ...REST,
    sy: toStep(sy, 1 / 64),
    sx: toStep(keptWidth(sy) + bulge / 12.5, 1 / 64),
    lean: toStep(lean, 1 / 4),
    hatDX: toStep(hat),
    face: toStep(Math.sin(roll) * 10),
    eyes,
    mouth,
  };
}

/** Frames made, by look and pose; let go together once this many have gathered. */
const KEPT = 512;
const made = new Map<string, MiniFrame>();
const mirrors = new WeakMap<MiniFrame, MiniFrame>();

const flipped = (rows: readonly string[]) => rows.map((row) => [...row].toReversed().join(""));

/** `frame` facing the other way. */
function mirrored(frame: MiniFrame): MiniFrame {
  let mirror = mirrors.get(frame);
  if (mirror === undefined) {
    mirror = {
      rows: flipped(frame.rows),
      detail: flipped(frame.detail),
      drawn: { rows: flipped(frame.drawn.rows), detail: flipped(frame.drawn.detail) },
    };
    mirrors.set(frame, mirror);
  }
  return mirror;
}

/**
 * The frame a Cell in `look` shows in flight at `now` (`performance.now()`
 * ms), drawn `points` CSS px a cell: its pose (`tossPose`), or its walk home
 * facing home.
 */
export function tossFrame(
  look: CellLook,
  toss: Toss,
  now: number,
  points = POINTS_PER_PIXEL,
  steady = false,
): MiniFrame {
  const walk = toss.walking === undefined ? undefined : sceneOf(look, WALK);
  if (walk !== undefined && toss.walking !== undefined) {
    const rate = toss.walking.rate ?? 1;
    const beats = Math.max(0, ((now - toss.walking.from) / 1000) * onBeat(walk.fps) * rate);
    const frame = walk.mini[Math.trunc(beats) % walk.mini.length]!;
    return toss.walking.toward > 0 ? mirrored(frame) : frame;
  }
  const pose = tossPose(toss, now, points, steady);
  const key = `${look.name}|${look.strength ?? ""}|${pose.sy}|${pose.sx}|${pose.lean}|${pose.hatDX}|${pose.face}|${pose.eyes}|${pose.mouth}`;
  let frame = made.get(key);
  if (frame === undefined) {
    frame = frameIn(look, "toss", pose);
    if (made.size >= KEPT) made.clear();
    made.set(key, frame);
  }
  return frame;
}

/** A star of the dizzy beat: its centre from the box's centre, CSS px, its size and how bright it is. */
export interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly alpha: number;
}

/**
 * The dizzy beat's three stars `t` ms in, round the head of a Cell drawn
 * `points` CSS px a cell, over a beat of `duration` ms: circling one and a
 * half times a second, the near ones larger and brighter, fading over its
 * last fifth of a second.
 */
export function dizzyStars(t: number, duration: number, points = POINTS_PER_PIXEL): Star[] {
  const { unit } = worldAt(points);
  const width = BOX.width * points;
  const height = BOX.height * points;
  const seconds = Math.max(0, t) / 1000;
  const fade = Math.min(1, Math.max(0, (duration - t) / 200));
  return [0, 1, 2].map((i) => {
    const angle = 2 * Math.PI * (seconds * 1.5 + i / 3);
    const near = (Math.sin(angle) + 1) / 2;
    return {
      x: Math.cos(angle) * width * 0.6,
      y: -height * 0.46 + Math.sin(angle) * height * 0.1,
      r: (3.2 + 1.8 * near) * unit,
      alpha: (0.55 + 0.45 * near) * fade,
    };
  });
}

/** The word a real hit says. */
export const BONK = "BONK!";

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the word's centre goes for a hit on `surface`: in from the edge it hit, out of the
 * body's way (`body` is pressed against that edge, leaving along `heading`), inside the chat
 * (`bounds`), else the next clear place. `extent` is half the word at its largest.
 */
export function wordCentre(
  surface: Surface,
  extent: { readonly width: number; readonly height: number },
  body: Rect,
  bounds: Rect,
  heading: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
): { readonly x: number; readonly y: number } {
  const e = extent;
  const over = body.y - e.height - 2;
  const under = body.y + body.height + e.height + 2;
  const middle = body.x + body.width / 2;
  let places: { x: number; y: number }[];
  if (surface === "left" || surface === "right") {
    // Off a wall: in from it, over the body, or under it when it is going up.
    const x = surface === "left" ? bounds.x + e.width + 2 : bounds.x + bounds.width - e.width - 2;
    places = (heading.y < 0 ? [under, over] : [over, under]).map((y) => ({ x, y }));
  } else {
    // Off the top or the floor: along it, beside the body, behind it as it
    // travels; still, toward the room. Cornered, past the body off the
    // surface; only then ahead of it.
    const moving = Math.abs(heading.x) > 20;
    const side = moving ? (heading.x > 0 ? -1 : 1) : middle < bounds.x + bounds.width / 2 ? 1 : -1;
    const ahead =
      heading.x > 0 ? bounds.x + bounds.width - (body.x + body.width) : body.x - bounds.x;
    const y =
      surface === "ceiling" ? bounds.y + e.height + 2 : bounds.y + bounds.height - e.height - 2;
    const beside = (s: number) => ({ x: middle + s * (body.width / 2 + e.width + 2), y });
    const past = { x: middle, y: surface === "ceiling" ? under : over };
    places =
      moving && ahead < body.width
        ? [past, beside(side), beside(-side)]
        : [beside(side), past, beside(-side)];
  }
  // Inside the chat, even a small one, or with the body in a corner.
  const inset = {
    left: bounds.x + Math.min(e.width + 2, bounds.width / 2),
    right: bounds.x + bounds.width - Math.min(e.width + 2, bounds.width / 2),
    top: bounds.y + Math.min(e.height + 2, bounds.height / 2),
    bottom: bounds.y + bounds.height - Math.min(e.height + 2, bounds.height / 2),
  };
  const inside = places.map((p) => ({
    x: Math.min(Math.max(p.x, inset.left), inset.right),
    y: Math.min(Math.max(p.y, inset.top), inset.bottom),
  }));
  const clear = (p: { x: number; y: number }) =>
    p.x + e.width <= body.x ||
    p.x - e.width >= body.x + body.width ||
    p.y + e.height <= body.y ||
    p.y - e.height >= body.y + body.height;
  return inside.find(clear) ?? inside[0]!;
}
