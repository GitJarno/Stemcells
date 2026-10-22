/**
 * The world a thrown Cell flies in: the original's soft Cell, alone in a
 * world of its own (the original app's `MochiWorld.swift` and `MochiToss.swift`,
 * ported line for line where one body goes). Gravity pulls, a landing
 * squashes it and the floor gives like a drum skin, friction turns a throw
 * into a slide, braking tips its crown, a wall flattens it the other way. It
 * never tumbles: an off-centre throw rolls its face round until it lands.
 *
 * A fixed step: the world advances whole frames of 1/24 world second, eight
 * substeps each, and the Cell glides between its last two frames, so a
 * flight is the same at any frame rate. The world's clock runs fast enough
 * that a thrown Cell falls 1400 CSS px a second² whatever its size. It
 * settles exactly, so a still Cell is still to the last bit.
 *
 * Two units: the world's px and seconds inside (the body is 25 px across, y
 * down), CSS px and seconds outside, `unit` CSS px a world px. A body never
 * leaves `bounds`: its sides, its top, and its floor, the line its feet
 * stand on at home.
 */
import type { Rect } from "./arrangement";
import type { Point, Size } from "./carry";

// ── The world (MochiWorld.swift)

/** px/s²: a 40 px drop takes ~0.43 s (MochiWorld.swift:22). */
const GRAVITY = 430;
/** World frames a second, and substeps a frame (MochiWorld.swift:23-25). */
export const WORLD_FPS = 24;
const SUBSTEPS = 8;
const DT = 1 / (WORLD_FPS * SUBSTEPS);
/** At most this many dents in the floor at once (MochiWorld.swift:27). */
const MAX_DENTS = 12;
/** Sliding friction, px/s², and how much more a still body takes to break loose (MochiWorld.swift:244-245). */
const GRIP = 300;
const STATIC_GRIP = 1.3;
/** What a landing gives back (MochiWorld.swift:137). */
const RESTITUTION = 0.32;
/** The body's height at rest, rows (MochiRig.swift:116). */
const REST_ROWS = 16;

/** A damped spring toward `rest`: the one primitive behind every wobble. */
interface Spring {
  x: number;
  v: number;
  rest: number;
  readonly k: number;
  readonly c: number;
}

const spring = (rest: number, k: number, c: number): Spring => ({ x: rest, v: 0, rest, k, c });
const settled = (s: Spring) => s.x === s.rest && s.v === 0;

/** It settles exactly, so a still world is still to the last bit (MochiWorld.swift:48-53). */
function stepSpring(s: Spring, dt: number): void {
  if (settled(s)) return;
  s.v += (-s.k * (s.x - s.rest) - s.c * s.v) * dt;
  s.x += s.v * dt;
  if (Math.abs(s.x - s.rest) < 1e-3 && Math.abs(s.v) < 1e-2) {
    s.x = s.rest;
    s.v = 0;
  }
}

/**
 * The thrown Cell as a body: where its base is, how fast it goes, and its
 * springs (MochiWorld.swift:133-193). Its melt and float, its hat and its
 * peers never move in a toss, so they aren't here.
 */
interface Body {
  /** Its middle, and its base row (sub-pixel). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Its height scale: the pancake and the stretch. */
  squash: Spring;
  /** Width from a side hit, px. */
  bulge: Spring;
  /** The crown's sideways offset, px. */
  lean: Spring;
  /** The hat's sideways lag, px. */
  hatX: Spring;
  /** A roll: the face goes round. Radians, and radians a second. */
  spin: number;
  spinV: number;
  /** Frames of a braced face after a hit. */
  ouch: number;
}

const newBody = (): Body => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  grounded: true,
  squash: spring(1, 330, 11),
  bulge: spring(0, 260, 10),
  lean: spring(0, 150, 8),
  hatX: spring(0, 90, 6),
  spin: 0,
  spinV: 0,
  ouch: 0,
});

/** The width that keeps the volume at height scale `sy`: 1 / sy^0.75 (MochiRig.swift:128-131). */
function keptWidth(sy: number): number {
  const root = Math.sqrt(sy);
  return 1 / (root * Math.sqrt(root));
}

const halfWidth = (b: Body) => 12.5 * keptWidth(Math.max(b.squash.x, 0.3)) + b.bulge.x;
const heightOf = (b: Body) => REST_ROWS * b.squash.x;

/** A dent in the floor where something landed: it springs back. */
interface Dent {
  readonly x: number;
  readonly s: Spring;
}

interface World {
  body: Body;
  dents: Dent[];
  /** The scene's shake from a hard hit: only its settling matters here. */
  shake: Spring;
  /** The floor's top row; the body stands with its base on the row above. */
  floor: number;
  wallLeft: number;
  wallRight: number;
}

const copySpring = (s: Spring): Spring => ({ ...s });
const copyWorld = (w: World): World => ({
  ...w,
  body: {
    ...w.body,
    squash: copySpring(w.body.squash),
    bulge: copySpring(w.body.bulge),
    lean: copySpring(w.body.lean),
    hatX: copySpring(w.body.hatX),
  },
  dents: w.dents.map((d) => ({ x: d.x, s: copySpring(d.s) })),
  shake: copySpring(w.shake),
});

/** What hit what in a substep, in world px a second: for the Cell's springs as it draws them. */
export interface Contact {
  readonly surface: "left" | "right" | "ceiling" | "floor";
  /** Into the surface. */
  readonly speed: number;
  /** Along it, right positive: a landing's skid. */
  readonly along: number;
  /** The substep it happened in, 1 to 8; 8 for the top, which a frame judges whole. */
  readonly substep: number;
}

/** The floor's top row under `x`, dents included (MochiWorld.swift:400-407). */
function roofY(w: World, x: number): number {
  let y = w.floor;
  for (const d of w.dents) {
    const u = (x - d.x) / 6.5;
    y += d.s.x * Math.exp(-u * u);
  }
  return y;
}

/** Something landed at `x`: the floor dents there (MochiWorld.swift:677-685). */
function dent(w: World, x: number, kick: number): void {
  const near = w.dents.find((d) => Math.abs(d.x - x) < 4);
  if (near) {
    near.s.v += kick;
  } else if (w.dents.length < MAX_DENTS) {
    const s = spring(0, 520, 13);
    s.v = kick;
    w.dents.push({ x, s });
  }
}

/** Friction on the ground: a moving body brakes at its sliding grip (MochiWorld.swift:556-564, no wind). */
function slide(b: Body, dt: number): void {
  const sliding = GRIP;
  const holding = sliding * STATIC_GRIP;
  const pull = 0;
  let rel = b.vx;
  if (rel === 0 && Math.abs(pull) <= holding) {
    b.vx = 0;
    return;
  }
  rel += pull * dt;
  const brake = sliding * dt;
  if (Math.abs(rel) <= brake && Math.abs(pull) <= holding) rel = 0;
  else rel -= brake * (rel > 0 ? 1 : -1);
  b.vx = rel;
}

/** The landing: the pancake, the dent, and what bounces back (MochiWorld.swift:566-596). */
function land(w: World, b: Body, under: number, contacts: Contact[], substep: number): void {
  const v = b.vy;
  contacts.push({ surface: "floor", speed: v, along: b.vx, substep });
  b.y = under;
  b.squash.v -= v * 0.0125;
  b.hatX.rest = 0;
  b.lean.v += b.vx * 0.15;
  // It lands facing front, the turn done.
  b.spin = 0;
  b.spinV = 0;
  dent(w, b.x, v * 0.07);
  if (v > 260) w.shake.v += (v - 200) * 0.25;
  b.ouch = Math.max(b.ouch, Math.trunc(v / 45));
  // A heavy hit gives back less.
  const e = RESTITUTION * Math.max(0.35, 1 - v / 700);
  if (v * e > 45) {
    b.vy = -v * e;
  } else {
    b.vy = 0;
    b.grounded = true;
  }
}

/** A side hit flattens it the other way, and the hat lags (MochiWorld.swift:598-607). */
function wallHit(w: World, b: Body, dir: 1 | -1, contacts: Contact[], substep: number): void {
  const v = Math.abs(b.vx);
  const dv = -b.vx * 1.35;
  contacts.push({ surface: dir === 1 ? "left" : "right", speed: v, along: b.vy, substep });
  b.bulge.v -= v * 0.06;
  b.squash.v += v * 0.006;
  b.lean.v += dir * v * 0.08;
  b.hatX.v -= dv * 0.35;
  b.ouch = Math.max(b.ouch, Math.trunc(v / 50));
  if (v > 120) w.shake.v += v * 0.05;
  b.vx = -b.vx * 0.35;
}

/** One substep (MochiWorld.swift:488-540, one body, no wind). */
function substep(w: World, contacts: Contact[], index: number): void {
  const b = w.body;
  const under = roofY(w, b.x) - 1;
  if (!b.grounded) {
    b.vy += GRAVITY * DT;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    // Stretched along a fast fall, leaning into its flight, the hat trailing.
    b.squash.rest = 1 + Math.min(0.3, Math.abs(b.vy) * 0.00065);
    b.lean.rest = b.vx * 0.012;
    b.hatX.rest = -b.vx * 0.012;
    b.spin += b.spinV * DT;
    if (b.vy > 0 && b.y >= under) land(w, b, under, contacts, index);
  } else {
    const before = b.vx;
    slide(b, DT);
    const ax = (b.vx - before) / DT;
    b.x += b.vx * DT;
    if (under > b.y + 2) {
      // What held it went away: it falls from where it is.
      b.grounded = false;
      b.vy = 0;
    } else {
      b.y = under;
    }
    b.squash.rest = 1;
    // Braking tips the crown forward.
    b.lean.rest = -ax * 0.011;
    b.hatX.rest = -ax * 0.008;
    b.spinV *= 1 - 6 * DT;
    b.spin += b.spinV * DT;
    // The nearest full turn: facing front.
    if (Math.abs(b.spinV) < 0.4) {
      b.spin = 0;
      b.spinV = 0;
    }
  }
  if (b.x - halfWidth(b) < w.wallLeft && b.vx < 0) {
    b.x = w.wallLeft + halfWidth(b);
    wallHit(w, b, 1, contacts, index);
  }
  if (b.x + halfWidth(b) > w.wallRight && b.vx > 0) {
    b.x = w.wallRight - halfWidth(b);
    wallHit(w, b, -1, contacts, index);
  }
  stepSpring(b.squash, DT);
  stepSpring(b.bulge, DT);
  stepSpring(b.lean, DT);
  stepSpring(b.hatX, DT);
  for (const d of w.dents) stepSpring(d.s, DT);
  w.dents = w.dents.filter((d) => !settled(d.s));
  stepSpring(w.shake, DT);
}

/** One world frame (MochiWorld.swift:447-486). */
function stepWorld(w: World, contacts: Contact[]): void {
  if (w.body.ouch > 0) w.body.ouch -= 1;
  for (let s = 1; s <= SUBSTEPS; s++) substep(w, contacts, s);
}

/** The body is still: down, unmoving, every spring settled (MochiWorld.swift:387-397). */
function isStill(w: World): boolean {
  const b = w.body;
  return (
    b.grounded &&
    b.vx === 0 &&
    b.vy === 0 &&
    b.spinV === 0 &&
    b.ouch === 0 &&
    settled(b.squash) &&
    settled(b.bulge) &&
    settled(b.lean) &&
    settled(b.hatX)
  );
}

/** Nothing moves or wobbles, the floor's give gone too (MochiWorld.swift:381-384). */
const isAtRest = (w: World) => w.dents.length === 0 && settled(w.shake) && isStill(w);

// ── The toss (MochiToss.swift)

/** One world frame, world seconds (MochiToss.swift:64). */
const FRAME = 1 / WORLD_FPS;
/** A toss's fall, CSS px a second², whatever the Cell's size (MochiToss.swift:66). */
export const TOSS_GRAVITY = 1400;
/** What the top gives back (MochiToss.swift:69). */
const CEILING = 0.38;
/** A release faster than this, CSS px a second, is cut to it (MochiToss.swift:70). */
export const FASTEST = 1100;
/** Hanging from the hand, stretched this much (MochiToss.swift:72). */
const HANGING = 1.08;
/** World px across the body's box: the body's 26 (MochiToss.swift:76-78). */
const BOX_PX = 26;
/** Contacts slower than this, CSS px a second, are no hit (MochiToss.swift:292). */
export const IMPACT_SPEED = 100;
/** At most this much time, seconds, is caught up after a stall (MochiToss.swift:153). */
const CATCH_UP = 0.25;

/** A contact with the arena's edge, rather than the body's centre, in CSS px. */
export interface Impact {
  readonly surface: Contact["surface"];
  readonly point: Point;
  /** CSS px a second, into the surface. */
  readonly speed: number;
}

/** What one world frame did, for the flight to judge. */
export interface Frame {
  /** How long before the step's end it happened, seconds. */
  readonly before: number;
  /** Its contacts at `IMPACT_SPEED` or harder, the strongest on each surface. */
  readonly impacts: ReadonlyArray<Impact>;
  /** Every contact that set a spring going, in CSS px a second, with how long before the step's end. */
  readonly contacts: ReadonlyArray<Contact & { readonly before: number }>;
  /** The Cell's box's centre after it, CSS px. */
  readonly centre: Point;
  /** Its velocity after it, CSS px a second. */
  readonly velocity: Point;
  /** Down from its flight: on the floor, its slide and roll over. */
  readonly landed: boolean;
  /** Nothing moves at all, its springs settled to the last bit. */
  readonly resting: boolean;
}

/** A thrown Cell's body in its world: where it is and how it moves. */
export interface Motion {
  readonly world: World;
  /** CSS px a world px: the box's width over 26. */
  readonly unit: number;
  /** World seconds a second, so it falls at `TOSS_GRAVITY` at this size. */
  readonly pace: number;
  readonly box: Size;
  /** World seconds owed to the clock. */
  readonly debt: number;
  /** The box's centre at the world's last two frames: it glides between. */
  readonly from: Point;
  readonly to: Point;
  /** The box's centre now, CSS px. */
  readonly position: Point;
  readonly held: boolean;
  readonly resting: boolean;
}

/** The box's centre for body `b`: its feet on the box's bottom (MochiToss.swift:276-278). */
const centreOf = (m: Pick<Motion, "unit" | "box">, b: Body): Point => ({
  x: b.x * m.unit,
  y: b.y * m.unit - m.box.height / 2,
});

/** A release, cut to `FASTEST` along its own direction (MochiToss.swift:301-305). */
export function limited(v: Point): Point {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) return { x: 0, y: 0 };
  const factor = Math.min(1, FASTEST / Math.max(1, Math.hypot(v.x, v.y)));
  return { x: v.x * factor, y: v.y * factor };
}

/**
 * An off-centre grip's lever as a roll of the face, as hard as a rigid toss
 * would spin, radians a world second; a centre grab rolls nothing. `grip` is
 * the box's centre less the hand (MochiToss.swift:283-289).
 */
function roll(box: Size, pace: number, v: Point, grip: Point): number {
  if (!Number.isFinite(grip.x) || !Number.isFinite(grip.y)) return 0;
  const x = Math.min(Math.max(grip.x, -box.width / 2), box.width / 2);
  const y = Math.min(Math.max(grip.y, -box.height / 2), box.height / 2);
  const inertia = Math.max(1, (box.width * box.width + box.height * box.height) / 12);
  return Math.min(Math.max(((y * v.x - x * v.y) / inertia) * 0.35, -10), 10) / pace;
}

/** The arena's sides and floor in the world; a body outside them is put back in (MochiToss.swift:251-264). */
function fit(m: Motion, w: World, bounds: Rect): Motion {
  w.wallLeft = bounds.x / m.unit;
  w.wallRight = Math.max(w.wallLeft + BOX_PX, (bounds.x + bounds.width) / m.unit);
  w.floor = (bounds.y + bounds.height) / m.unit + 1;
  const b = w.body;
  const half = halfWidth(b);
  const top = bounds.y / m.unit;
  const x = Math.min(Math.max(b.x, w.wallLeft + half), w.wallRight - half);
  const y = Math.max(Math.min(b.y, w.floor - 1), Math.min(w.floor - 1, top + heightOf(b)));
  if (x === b.x && y === b.y) return m;
  b.x = x;
  b.y = y;
  const at = centreOf(m, b);
  return { ...m, to: at, from: at, position: at };
}

/** The body where the box's centre is `point` (MochiToss.swift:267-273). */
function place(m: Motion, w: World, point: Point): Motion {
  w.body.x = point.x / m.unit;
  w.body.y = (point.y + m.box.height / 2) / m.unit;
  return { ...m, position: point, from: point, to: point };
}

/** A frame in the hand: the springs settle, it hangs (MochiToss.swift:217-234). */
function hang(w: World): void {
  const b = w.body;
  b.squash.rest = HANGING;
  b.lean.rest = 0;
  b.hatX.rest = 0;
  b.bulge.rest = 0;
  for (let s = 0; s < SUBSTEPS; s++) {
    stepSpring(b.squash, DT);
    stepSpring(b.bulge, DT);
    stepSpring(b.lean, DT);
    stepSpring(b.hatX, DT);
  }
  if (b.ouch > 0) b.ouch -= 1;
}

/** Down from its flight: on the floor, nothing carrying it along (MochiToss.swift:103-106). */
export function hasLanded(m: Motion): boolean {
  const b = m.world.body;
  return m.resting || (!m.held && b.grounded && b.vx === 0 && b.vy === 0 && b.spinV === 0);
}

/** Its velocity, CSS px a second. */
export function velocityOf(m: Motion): Point {
  const k = m.unit * m.pace;
  return { x: m.world.body.vx * k, y: m.world.body.vy * k };
}

/** On the floor, sliding or still. */
export const groundedOf = (m: Motion): boolean => m.world.body.grounded;

/** The face's roll, radians: 0 faces front. */
export const rollOf = (m: Motion): number => m.world.body.spin;

/**
 * Let go of with `velocity` (CSS px a second) held by `grip` (the box's
 * centre less the hand), from where it is now (MochiToss.swift:129-138).
 */
export function release(m: Motion, velocity: Point, grip: Point): Motion {
  const w = copyWorld(m.world);
  const v = limited(velocity);
  const k = m.unit * m.pace;
  const b = w.body;
  b.vx = v.x / k;
  b.vy = v.y / k;
  b.grounded = false;
  b.spinV = roll(m.box, m.pace, v, grip);
  return { ...m, world: w, held: false, resting: false, debt: 0 };
}

/**
 * A thrown Cell's box of `box` CSS px, its centre at `position`, let go
 * with `velocity` held by `grip` (MochiToss.swift:74-90).
 */
export function throwMotion(position: Point, velocity: Point, box: Size, grip: Point): Motion {
  const width = Number.isFinite(box.width) && box.width > 0 ? box.width : BOX_PX;
  const size = { width, height: Number.isFinite(box.height) ? Math.max(0, box.height) : 0 };
  const unit = width / BOX_PX;
  const start =
    Number.isFinite(position.x) && Number.isFinite(position.y) ? position : { x: 0, y: 0 };
  const w: World = {
    body: newBody(),
    dents: [],
    shake: spring(0, 900, 18),
    floor: 10_000,
    wallLeft: -Number.MAX_VALUE,
    wallRight: Number.MAX_VALUE,
  };
  let m: Motion = {
    world: w,
    unit,
    pace: Math.sqrt(TOSS_GRAVITY / (GRAVITY * unit)),
    box: size,
    debt: 0,
    from: start,
    to: start,
    position: start,
    held: false,
    resting: false,
  };
  m = place(m, w, start);
  return release(m, velocity, grip);
}

/** Caught at `point` (the box's centre): it stops, and hangs from the hand (MochiToss.swift:114-127). */
export function catchAt(m: Motion, point: Point): Motion {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return m;
  const w = copyWorld(m.world);
  const caught = place(m, w, point);
  const b = w.body;
  b.vx = 0;
  b.vy = 0;
  b.spin = 0;
  b.spinV = 0;
  b.grounded = false;
  return { ...caught, world: w, held: true, resting: false };
}

/** The strongest contact on each surface, at `IMPACT_SPEED` or harder (MochiToss.swift:291-299). */
function impact(impacts: Impact[], surface: Contact["surface"], point: Point, speed: number): void {
  if (speed < IMPACT_SPEED) return;
  const index = impacts.findIndex((i) => i.surface === surface);
  if (index < 0) impacts.push({ surface, point, speed });
  else if (impacts[index]!.speed < speed) impacts[index] = { surface, point, speed };
}

/** One world frame in flight, with its contacts as the toss reads them (MochiToss.swift:165-214). */
function frame(
  m: Motion,
  w: World,
  bounds: Rect,
): { motion: Motion; impacts: Impact[]; contacts: Contact[] } {
  const before = { ...w.body };
  const k = m.unit * m.pace;
  const contacts: Contact[] = [];
  const impacts: Impact[] = [];
  stepWorld(w, contacts);
  const b = w.body;
  const top = bounds.y / m.unit;
  if (b.y - heightOf(b) < top && b.vy < 0) {
    // The arena's top: it gives back what a toss's ceiling does, and the hit
    // presses the body down.
    contacts.push({ surface: "ceiling", speed: -b.vy, along: b.vx, substep: SUBSTEPS });
    impact(impacts, "ceiling", { x: b.x * m.unit, y: bounds.y }, -b.vy * k);
    b.ouch = Math.max(b.ouch, Math.trunc(-b.vy / 50));
    b.squash.v -= -b.vy * 0.006;
    b.vy *= -CEILING;
    b.y = top + heightOf(b);
  }
  // Alone in its world, only a wall turns it round.
  if (before.vx < 0 && b.vx > 0) {
    impact(impacts, "left", { x: bounds.x, y: (b.y - heightOf(b) / 2) * m.unit }, -before.vx * k);
  }
  if (before.vx > 0 && b.vx < 0) {
    impact(
      impacts,
      "right",
      { x: bounds.x + bounds.width, y: (b.y - heightOf(b) / 2) * m.unit },
      before.vx * k,
    );
  }
  if (!before.grounded && (b.grounded || (before.vy > 0 && b.vy < 0))) {
    impact(
      impacts,
      "floor",
      { x: b.x * m.unit, y: bounds.y + bounds.height },
      Math.max(0, before.vy) * k,
    );
  }
  let next: Motion = { ...m, from: m.to, to: centreOf(m, b) };
  // At rest once the body and the floor under it are.
  if (isStill(w) && isAtRest(w)) {
    // On the floor line itself, the last of its give gone.
    b.y = w.floor - 1;
    const at = centreOf(m, b);
    next = { ...next, to: at, from: at, resting: true };
  }
  return { motion: next, impacts, contacts };
}

/**
 * `seconds` on, in `bounds` (CSS px: its sides, its top, and its floor at
 * the bottom), and what each world frame did (MochiToss.swift:140-162).
 * Held, it hangs where the hand put it.
 */
export function stepMotion(
  motion: Motion,
  seconds: number,
  bounds: Rect,
): { motion: Motion; frames: Frame[] } {
  const frames: Frame[] = [];
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width < 0 ||
    bounds.height < 0
  ) {
    return { motion, frames };
  }
  const w = copyWorld(motion.world);
  let m = fit({ ...motion, world: w }, w, bounds);
  // A taller arena beneath a resting body lets it fall again.
  if (m.resting && !m.held) {
    if (w.body.y >= w.floor - 1) return { motion: m, frames };
    m = { ...m, resting: false };
    w.body.grounded = false;
  }
  if (!Number.isFinite(seconds) || seconds <= 0) return { motion: m, frames };
  let debt = m.debt + Math.min(seconds, CATCH_UP) * m.pace;
  const k = m.unit * m.pace;
  while (debt >= FRAME) {
    debt -= FRAME;
    if (m.held) {
      hang(w);
      continue;
    }
    const done = frame(m, w, bounds);
    m = done.motion;
    const before = debt / m.pace;
    frames.push({
      before,
      impacts: done.impacts,
      contacts: done.contacts.map((c) => ({
        ...c,
        speed: c.speed * k,
        along: c.along * k,
        before: before + ((SUBSTEPS - c.substep) / SUBSTEPS) * (FRAME / m.pace),
      })),
      centre: m.to,
      velocity: velocityOf(m),
      landed: hasLanded(m),
      resting: m.resting,
    });
    if (m.resting) {
      debt = 0;
      break;
    }
  }
  if (m.held) return { motion: { ...m, debt }, frames };
  const t = m.resting ? 1 : debt / FRAME;
  const position = {
    x: m.from.x + (m.to.x - m.from.x) * t,
    y: m.from.y + (m.to.y - m.from.y) * t,
  };
  return { motion: { ...m, debt, position }, frames };
}
