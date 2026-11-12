// A score: an act written as phrases (`leap`, `spin`, `sway`, `nod`), each carrying its craft
// once: the crouch before a jump, the hang at its top, the faster fall, the damped settle. Face,
// arms and stance persist between phrases; marks ride a span of frames by name. `scored` makes
// the frames every scene has. Pure data in, pure data out (`stemcells/tasks/cell-acts.md`).

import bodyData from "./kit/body.json" with { type: "json" };
import type { Arm } from "./kit.ts";

const REST_BASE = bodyData.rig.restBase;
const REST_X = bodyData.rig.restX;
/** One row of the body at rest, as a share of its height: the smallest squash that shows. */
const ROW = 1 / bodyData.rig.restRows;

/** A mark a score shows (a note, a star, a z) as its file holds it: art with no anchor of its own. */
export interface ScoreMark {
  readonly about?: string;
  readonly art: readonly string[];
  readonly hotspot: readonly number[];
  readonly z?: number;
  readonly mini: readonly string[];
  readonly miniHotspot: readonly number[];
}

/** One step of a score: a phrase by name (`do`) and what it takes. */
export interface Step {
  readonly do: string;
  readonly [param: string]: unknown;
}

/** A frame as a move file holds it: what is left out stays at rest. */
export interface ScoredFrame {
  readonly pose: {
    base?: number;
    x?: number;
    sy?: number;
    spread?: number;
    lean?: number;
    float?: number;
    face?: number;
    hatDX?: number;
    eyes?: string;
    mouth?: string;
    look?: readonly number[];
    arms?: readonly Arm[];
  };
  readonly layers?: {
    readonly art: readonly string[];
    readonly attach: string;
    readonly hotspot: readonly number[];
    readonly z: number;
    readonly mini: readonly string[];
    readonly miniHotspot: readonly number[];
  }[];
}

export interface Scored {
  readonly frames: readonly ScoredFrame[];
  /** The frame that tells the act: what Reduce Motion holds. */
  readonly tell: number | undefined;
  /** What the score asks for that there isn't: a phrase, a mark, an arm. `check` fails on any. */
  readonly problems: readonly string[];
}

/** The arms a score names: how far out and up the hand goes, in hero cells, and where the arm leaves the side. */
const ARMS: Readonly<Record<string, Omit<Arm, "side">>> = {
  /** Straight up: a cheer, a stretch. */
  up: { at: 0.7, dx: 3, dy: -5 },
  /** Up and out: a point at the sky. */
  high: { at: 0.7, dx: 4, dy: -3 },
  /** Level: wings, a balance. */
  out: { at: 0.55, dx: 4, dy: 0 },
  /** Raised beside the crown, where a hand has room to show: a thumb, a fist. */
  raised: { at: 0.75, dx: 2, dy: -4 },
  /** Down and out: a shrug's start, a point at the floor. */
  low: { at: 0.45, dx: 3, dy: 2 },
  /** Tucked at the hip. */
  hip: { at: 0.4, dx: 2, dy: 1 },
  /** To the brow: a salute. */
  brow: { at: 0.8, dx: 1, dy: -3 },
};

/** What persists from one phrase to the next. */
interface Carry {
  eyes: string;
  mouth: string;
  look: readonly [number, number];
  left: Omit<Arm, "side"> | undefined;
  right: Omit<Arm, "side"> | undefined;
  /** The mark in each hand, while its arm is out. */
  leftHolds: string | undefined;
  rightHolds: string | undefined;
  sy: number;
  spread: number;
  lean: number;
  shift: number;
  float: number;
  /** Rows its base stands above the ground: held in the air. */
  lift: number;
  /** Turned away: the back of its head. */
  back: boolean;
}

const AT_REST: Carry = {
  eyes: "calm",
  mouth: "none",
  look: [0, 0],
  left: undefined,
  right: undefined,
  leftHolds: undefined,
  rightHolds: undefined,
  sy: 1,
  spread: 0,
  lean: 0,
  shift: 0,
  float: 0,
  lift: 0,
  back: false,
};

/** What one frame changes over what is carried, for that frame alone. */
interface Over {
  sy?: number;
  spread?: number;
  lean?: number;
  shift?: number;
  lift?: number;
  float?: number;
  face?: number;
  hatDX?: number;
  eyes?: string;
  mouth?: string;
  look?: readonly [number, number];
  left?: Omit<Arm, "side"> | null;
  right?: Omit<Arm, "side"> | null;
}

const to64 = (value: number): number => Math.round(value * 64) / 64;
const to4 = (value: number): number => Math.round(value * 4) / 4;

/** `count` values from `from` to `to`, quick then slow: the last is `to`. */
function easedOut(from: number, to: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    return from + (to - from) * (1 - (1 - t) * (1 - t));
  });
}

/** `count` values from `from` to `to`, slow, quick, slow: the last is `to`. */
function easedBoth(from: number, to: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count;
    return from + (to - from) * t * t * (3 - 2 * t);
  });
}

const num = (value: unknown, otherwise: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : otherwise;
const whole = (value: unknown, otherwise: number): number =>
  Math.max(0, Math.round(num(value, otherwise)));
const word = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;
const pair = (value: unknown): readonly [number, number] | undefined =>
  Array.isArray(value) ? [num(value[0], 0), num(value[1], 0)] : undefined;

/**
 * The frames `score` plays, twelve a second, with the `marks` it names. A phrase the score
 * names that there isn't is left out and reported; so is a mark or an arm.
 */
export function scored(
  score: readonly Step[],
  marks: Readonly<Record<string, ScoreMark>> = {},
): Scored {
  const frames: { pose: ScoredFrame["pose"]; layers: NonNullable<ScoredFrame["layers"]> }[] = [];
  const problems: string[] = [];
  let carry: Carry = { ...AT_REST };
  let tell: number | undefined;
  /** The frame the phrase before named: its height, its landing. */
  const cues = new Map<string, number>();
  const spans: { step: Step; where: string; from: number }[] = [];
  const held: { frame: number; mark: string; attach: string }[] = [];

  const emit = (over: Over = {}): number => {
    const left = over.left === null ? undefined : (over.left ?? carry.left);
    const right = over.right === null ? undefined : (over.right ?? carry.right);
    const arms: Arm[] = [];
    if (left !== undefined) arms.push({ ...left, side: -1 });
    if (right !== undefined) arms.push({ ...right, side: 1 });
    const sy = to64(over.sy ?? carry.sy);
    const spread = to4(over.spread ?? carry.spread);
    const lean = to4(over.lean ?? carry.lean);
    const shift = Math.round(over.shift ?? carry.shift);
    const lift = Math.round(over.lift ?? carry.lift);
    const float = Math.round(over.float ?? carry.float);
    const face = Math.round(over.face ?? 0);
    const hatDX = Math.round(over.hatDX ?? 0);
    const eyes = carry.back ? "none" : (over.eyes ?? carry.eyes);
    const mouth = carry.back ? "none" : (over.mouth ?? carry.mouth);
    const look = over.look ?? carry.look;
    const pose: ScoredFrame["pose"] = {};
    if (lift !== 0) pose.base = REST_BASE - lift;
    if (shift !== 0) pose.x = REST_X + shift;
    if (sy !== 1) pose.sy = sy;
    if (spread !== 0) pose.spread = spread;
    if (lean !== 0) pose.lean = lean;
    if (float !== 0) pose.float = float;
    if (face !== 0) pose.face = face;
    if (hatDX !== 0) pose.hatDX = hatDX;
    if (eyes !== "calm") pose.eyes = eyes;
    if (mouth !== "none") pose.mouth = mouth;
    if (look[0] !== 0 || look[1] !== 0) pose.look = [look[0], look[1]];
    if (arms.length > 0) pose.arms = arms;
    frames.push({ pose, layers: [] });
    if (left !== undefined && carry.leftHolds !== undefined)
      held.push({ frame: frames.length - 1, mark: carry.leftHolds, attach: "handL" });
    if (right !== undefined && carry.rightHolds !== undefined)
      held.push({ frame: frames.length - 1, mark: carry.rightHolds, attach: "handR" });
    return frames.length - 1;
  };

  const armOf = (value: unknown, where: string): Omit<Arm, "side"> | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === "none") return null;
    if (typeof value === "string") {
      const arm = ARMS[value];
      if (arm === undefined) problems.push(`${where}: no arm "${value}"`);
      return arm;
    }
    if (typeof value === "object") {
      const raw = value as Partial<Arm>;
      return { at: num(raw.at, 0.5), dx: num(raw.dx, 3), dy: num(raw.dy, 0) };
    }
    return undefined;
  };

  /** The arms a phrase raises for its own frames, from `arms` (both), `left` and `right`. */
  const armsOver = (step: Step, where: string): Pick<Over, "left" | "right"> => {
    const both = armOf(step.arms, where);
    // `null` drops an arm: only a side left unsaid takes what both are told.
    const one = (side: unknown) => (side === undefined ? both : armOf(side, where));
    const left = one(step.left);
    const right = one(step.right);
    return {
      ...(left === undefined ? {} : { left }),
      ...(right === undefined ? {} : { right }),
    };
  };

  /** The face a phrase wears for its own frames. */
  const faceOver = (step: Step): Pick<Over, "eyes" | "mouth"> => ({
    ...(word(step.eyes) === undefined ? {} : { eyes: word(step.eyes)! }),
    ...(word(step.mouth) === undefined ? {} : { mouth: word(step.mouth)! }),
  });

  /** Back to the height it carries after a squash, ringing once: over by a row, then home. */
  const settle = (over: Over = {}) => {
    emit({ ...over, sy: carry.sy + ROW, spread: carry.spread });
    emit(over);
  };

  /**
   * One jump: the crouch, the launch stretched, the rise quick then slow, the hang, the fall
   * faster than the rise, the landing squashed. Names its height (`apex`) and its landing
   * (`land`); returns the height's frame.
   */
  const leap = (step: Step, where: string, anticipates: boolean): number => {
    const height = Math.max(1, whole(step.height, 4));
    const depth = Math.max(1, whole(step.depth, height >= 5 ? 3 : height >= 3 ? 2 : 1));
    const crouch = anticipates ? whole(step.crouch, height >= 3 ? 2 : 1) : 0;
    const hang = whole(step.hang, height >= 5 ? 2 : height >= 3 ? 1 : 0);
    const air: Over = { ...armsOver(step, where), ...faceOver(step) };
    const low = carry.sy - depth * ROW;
    easedOut(carry.sy, low, crouch).forEach((sy, i) =>
      emit({ sy, spread: carry.spread + ((i + 1) / crouch) * 0.2 * depth }),
    );
    const stretch = Math.min(3, Math.ceil(height / 2)) * ROW;
    const rise = height >= 4 ? [0.5, 0.85] : height >= 2 ? [0.5] : [];
    rise.forEach((share, i) =>
      emit({
        ...air,
        lift: carry.lift + Math.max(1, Math.round(height * share)),
        sy: carry.sy + (i === 0 ? stretch : ROW),
      }),
    );
    const apex = emit({ ...air, lift: carry.lift + height });
    for (let i = 0; i < hang; i++) emit({ ...air, lift: carry.lift + height });
    if (height >= 4)
      emit({ ...air, lift: carry.lift + Math.round(height * 0.45), sy: carry.sy + ROW });
    const squash = Math.min(3, 1 + Math.floor(height / 3)) * ROW;
    cues.set("apex", apex);
    cues.set("land", emit({ sy: carry.sy - squash, spread: carry.spread + 0.5 }));
    return apex;
  };

  const run = (steps: readonly Step[], path: string): void => {
    steps.forEach((step, at) => {
      const where = `${path}${at} ${step.do}`;
      const first = frames.length;
      /** The frame that tells this phrase, where it has one of its own. */
      let told: number | undefined;
      switch (step.do) {
        case "hold": {
          const over = { ...armsOver(step, where), ...faceOver(step) };
          for (let i = 0; i < Math.max(1, whole(step.for, 1)); i++) emit(over);
          break;
        }
        case "face": {
          carry = {
            ...carry,
            eyes: word(step.eyes) ?? carry.eyes,
            mouth: word(step.mouth) ?? carry.mouth,
            look: pair(step.look) ?? carry.look,
          };
          break;
        }
        case "arms": {
          const { left, right } = armsOver(step, where);
          const holds = (side: "leftHolds" | "rightHolds") =>
            step[side] === undefined ? carry[side] : word(step[side]);
          // An arm travels: a frame or more part of the way, out or home, its hand empty.
          const goal = {
            left: left === undefined ? carry.left : (left ?? undefined),
            right: right === undefined ? carry.right : (right ?? undefined),
          };
          const between = whole(step.for, 1);
          const part = (side: "left" | "right", share: number): Omit<Arm, "side"> | null => {
            const from = carry[side];
            const to = goal[side];
            if (from === to) return to ?? null;
            const at = (to ?? from)!.at;
            const a = from ?? { at, dx: 0, dy: 0 };
            const b = to ?? { at, dx: 0, dy: 0 };
            return {
              at,
              dx: Math.round(a.dx + (b.dx - a.dx) * share),
              dy: Math.round(a.dy + (b.dy - a.dy) * share),
            };
          };
          const hands = { leftHolds: carry.leftHolds, rightHolds: carry.rightHolds };
          carry = { ...carry, leftHolds: undefined, rightHolds: undefined };
          if (goal.left !== carry.left || goal.right !== carry.right)
            for (let i = 1; i <= between; i++) {
              const share = i / (between + 1);
              emit({ left: part("left", share), right: part("right", share) });
            }
          carry = { ...carry, ...hands };
          carry = {
            ...carry,
            left: left === undefined ? carry.left : (left ?? undefined),
            right: right === undefined ? carry.right : (right ?? undefined),
            leftHolds: holds("leftHolds"),
            rightHolds: holds("rightHolds"),
          };
          break;
        }
        case "ease": {
          const count = Math.max(1, whole(step.for, 2));
          const goal = {
            sy: num(step.sy, carry.sy),
            spread: num(step.spread, carry.spread),
            lean: num(step.lean, carry.lean),
            shift: num(step.shift, carry.shift),
            float: num(step.float, carry.float),
            lift: num(step.lift, carry.lift),
          };
          const from = { ...carry };
          const way = step.way === "out" ? easedOut : easedBoth;
          const tracks = Object.fromEntries(
            (Object.keys(goal) as (keyof typeof goal)[]).map((key) => [
              key,
              way(from[key], goal[key], count),
            ]),
          ) as Record<keyof typeof goal, number[]>;
          for (let i = 0; i < count; i++)
            emit({
              sy: tracks.sy[i]!,
              spread: tracks.spread[i]!,
              lean: tracks.lean[i]!,
              shift: tracks.shift[i]!,
              float: tracks.float[i]!,
              lift: tracks.lift[i]!,
            });
          carry = { ...carry, ...goal };
          break;
        }
        case "leap": {
          told = leap(step, where, true);
          if (step.settle !== false) settle();
          break;
        }
        case "bounce": {
          // Each landing is the next one's crouch, each jump lower than the last.
          const times = Math.max(1, whole(step.times, 3));
          const decay = num(step.decay, 0.6);
          let height = Math.max(1, whole(step.height, 4));
          for (let i = 0; i < times; i++) {
            const apex = leap({ ...step, height }, where, i === 0);
            told ??= apex;
            height = Math.max(1, Math.round(height * decay));
          }
          settle();
          break;
        }
        case "squash": {
          // Down (or up, past 1) to a height, held, and home ringing.
          const goal = num(step.to, 0.85);
          const over = { ...armsOver(step, where), ...faceOver(step) };
          const spread = carry.spread + num(step.spread, goal < 1 ? 0.4 : 0);
          const into = Math.max(1, whole(step.in, 2));
          easedOut(carry.sy, goal, into).forEach((sy, i) =>
            emit({
              ...over,
              sy,
              spread: carry.spread + ((i + 1) / into) * (spread - carry.spread),
            }),
          );
          for (let i = 0; i < whole(step.hold, 2); i++) emit({ ...over, sy: goal, spread });
          told = frames.length - 1;
          if (goal < 1) settle();
          else {
            emit({ sy: carry.sy - ROW, spread: carry.spread + 0.3 });
            emit();
          }
          break;
        }
        case "nod": {
          const depth = Math.max(1, whole(step.depth, 1));
          const per = Math.max(2, whole(step.per, 4));
          const down: Over = {
            ...faceOver(step),
            ...armsOver(step, where),
            look: [carry.look[0], carry.look[1] + depth],
            sy: carry.sy - ROW,
          };
          const up: Over = { ...faceOver(step), ...armsOver(step, where) };
          for (let i = 0; i < Math.max(1, whole(step.times, 2)); i++) {
            for (let k = 0; k < Math.ceil(per / 2); k++) emit(down);
            told ??= frames.length - 1;
            for (let k = 0; k < Math.floor(per / 2); k++) emit(up);
          }
          break;
        }
        case "shake": {
          const reach = Math.max(1, whole(step.reach, 2));
          const per = Math.max(2, whole(step.per, 4));
          const over = { ...faceOver(step), ...armsOver(step, where) };
          for (let i = 0; i < Math.max(1, whole(step.times, 2)); i++) {
            for (let k = 0; k < Math.ceil(per / 2); k++) emit({ ...over, face: -reach });
            told ??= frames.length - 1;
            for (let k = 0; k < Math.floor(per / 2); k++) emit({ ...over, face: reach });
          }
          emit(over);
          break;
        }
        case "sway": {
          // Side to side on a beat, the crown leading: with `bob`, down through the middle; with
          // `step`, a step that way; with `raise`, the arm on that side up as it gets there.
          const reach = num(step.reach, 2);
          const per = Math.max(2, whole(step.per, 6));
          const bob = whole(step.bob, 0);
          const stride = whole(step.step, 0);
          const raise = armOf(step.raise, where) ?? undefined;
          const over = { ...faceOver(step), ...armsOver(step, where) };
          let from = { lean: carry.lean, shift: carry.shift };
          let side = num(step.dir, 1) < 0 ? -1 : 1;
          const beats = Math.max(1, whole(step.times, 2)) * 2;
          for (let beat = 0; beat <= beats; beat++) {
            const home = beat === beats;
            const goal = {
              lean: home ? carry.lean : carry.lean + side * reach,
              shift: home ? carry.shift : carry.shift + side * stride,
            };
            const leans = easedBoth(from.lean, goal.lean, per);
            const shifts = easedBoth(from.shift, goal.shift, per);
            for (let i = 0; i < per; i++) {
              const middle = Math.sin(((i + 1) / per) * Math.PI);
              const up = raise !== undefined && !home && i >= per - 2;
              emit({
                ...over,
                lean: leans[i]!,
                shift: shifts[i]!,
                sy: carry.sy - bob * ROW * middle,
                ...(up ? { [side < 0 ? "left" : "right"]: raise } : {}),
              });
            }
            if (beat === 0) told = frames.length - 1;
            from = goal;
            side = -side;
          }
          break;
        }
        case "wobble": {
          // Unsteady: the crown swings out and back, each swing smaller, the hat a beat behind.
          const per = Math.max(2, whole(step.per, 3));
          const decay = num(step.decay, 0.7);
          const over = { ...faceOver(step), ...armsOver(step, where) };
          let reach = num(step.reach, 3);
          let side = num(step.dir, 1) < 0 ? -1 : 1;
          let from = carry.lean;
          const times = Math.max(1, whole(step.times, 4));
          for (let i = 0; i <= times; i++) {
            const goal = i === times ? carry.lean : carry.lean + side * reach;
            easedOut(from, goal, per).forEach((lean, k) =>
              emit({ ...over, lean, hatDX: k === 0 && i < times ? -side : 0 }),
            );
            if (i === 0) told = frames.length - 1;
            from = goal;
            side = -side;
            reach *= decay;
          }
          break;
        }
        case "spin": {
          // Round on the spot, its face sliding off one side and back on from the other.
          const per = Math.max(4, whole(step.per, 8));
          const dir = num(step.dir, 1) < 0 ? -1 : 1;
          const rise = whole(step.rise, 0);
          const total = Math.max(1, whole(step.turns, 1)) * per;
          const over = { ...armsOver(step, where), ...faceOver(step) };
          for (let i = 1; i <= total; i++) {
            const angle = (i / per) * 2 * Math.PI;
            const away = Math.cos(angle) < -1e-9;
            const up = Math.round(rise * Math.sin((i / total) * Math.PI));
            emit({
              ...over,
              face: i === total ? 0 : dir * Math.round(Math.sin(angle) * 10),
              ...(away ? { eyes: "none", mouth: "none" } : {}),
              lift: carry.lift + up,
            });
            if (away) told ??= frames.length - 1;
          }
          break;
        }
        case "shiver": {
          const reach = Math.max(1, whole(step.reach, 1));
          const over = { ...faceOver(step), ...armsOver(step, where) };
          const count = Math.max(2, whole(step.for, 8));
          for (let i = 0; i < count; i++)
            emit({ ...over, shift: carry.shift + (i % 2 === 0 ? -reach : reach) });
          told = first;
          emit(over);
          break;
        }
        case "wave": {
          // One arm between two places, the rest of it still.
          const side = step.side === "left" ? "left" : "right";
          const a = armOf(step.a ?? "up", where);
          const b = armOf(step.b ?? "high", where);
          const per = Math.max(2, whole(step.per, 4));
          const over = faceOver(step);
          for (let i = 0; i < Math.max(1, whole(step.times, 2)); i++) {
            for (let k = 0; k < Math.ceil(per / 2); k++) emit({ ...over, [side]: a });
            told ??= frames.length - 1;
            for (let k = 0; k < Math.floor(per / 2); k++) emit({ ...over, [side]: b });
          }
          break;
        }
        case "turn": {
          // To the back of its head, or round to the front again.
          const dir = num(step.dir, 1) < 0 ? -1 : 1;
          const away = step.to !== "front";
          const count = Math.max(1, whole(step.for, 2));
          if (away === carry.back) break;
          const slide = Array.from({ length: count }, (_, i) =>
            Math.round(Math.sin(((i + 1) / (count + 1)) * (Math.PI / 2)) * 10),
          );
          if (away) {
            for (const face of slide) emit({ face: dir * face });
            carry = { ...carry, back: true };
            emit();
          } else {
            carry = { ...carry, back: false };
            // `reverse` on a copy: the phone runs this, and Hermes has no `toReversed`.
            for (const face of [...slide].reverse()) emit({ face: -dir * face });
            emit();
          }
          break;
        }
        case "pose": {
          const raw = (step.pose ?? {}) as Over & { arms?: unknown };
          const over: Over = { ...raw, ...armsOver(step, where) };
          for (let i = 0; i < Math.max(1, whole(step.for, 1)); i++) emit(over);
          break;
        }
        case "rest": {
          carry = { ...AT_REST, eyes: word(step.eyes) ?? AT_REST.eyes };
          for (let i = 0; i < Math.max(1, whole(step.for, 1)); i++) emit();
          break;
        }
        case "repeat": {
          const inner = Array.isArray(step.steps) ? (step.steps as Step[]) : [];
          for (let i = 0; i < Math.max(1, whole(step.times, 2)); i++) run(inner, `${where} `);
          break;
        }
        case "mark":
        case "orbit": {
          // Laid over the frames once all of them are known.
          const on = word(step.on);
          if (on !== undefined && !cues.has(on))
            problems.push(`${where}: no phrase before it names "${on}"`);
          spans.push({ step, where, from: cues.get(on ?? "") ?? frames.length });
          break;
        }
        default:
          problems.push(`${where}: no such phrase`);
      }
      if (step.tell === true) tell = told ?? Math.floor((first + frames.length - 1) / 2);
    });
  };

  run(score, "");

  /** `mark` on frame `frame`, its hotspot `dx`, `dy` hero cells from the anchor (half as far at the miniature). */
  const stamp = (
    mark: ScoreMark,
    attach: string,
    frame: number,
    dx: number,
    dy: number,
    z: number,
  ) => {
    const target = frames[frame];
    if (target === undefined) return;
    const x = Math.round(dx);
    const y = Math.round(dy);
    target.layers.push({
      art: mark.art,
      attach,
      hotspot: [(mark.hotspot[0] ?? 0) - x, (mark.hotspot[1] ?? 0) - y],
      z,
      mini: mark.mini,
      miniHotspot: [
        (mark.miniHotspot[0] ?? 0) - Math.trunc(x / 2),
        (mark.miniHotspot[1] ?? 0) - Math.trunc(y / 2),
      ],
    });
  };

  const unknown = new Set<string>();
  for (const { frame, mark: name, attach } of held) {
    const mark = marks[name];
    if (mark !== undefined) stamp(mark, attach, frame, 0, 0, mark.z ?? 5);
    else if (!unknown.has(name)) {
      unknown.add(name);
      problems.push(`no mark "${name}" for a hand to hold`);
    }
  }

  // A mark over a span of frames: standing, drifting a little each frame, or circling.
  for (const { step, where, from } of spans) {
    const mark = marks[word(step.mark) ?? ""];
    if (mark === undefined) {
      problems.push(`${where}: no mark "${String(step.mark)}"`);
      continue;
    }
    if (from >= frames.length) problems.push(`${where}: no frame follows it to ride`);
    const attach = word(step.at) ?? "headTop";
    const count = Math.max(1, whole(step.for, 1));
    const drift = pair(step.drift) ?? [0, 0];
    const every = Math.max(1, whole(step.every, 1));
    if (step.do === "mark") {
      for (let i = 0; i < count; i++) {
        const moved = Math.floor(i / every);
        stamp(
          mark,
          attach,
          from + i,
          num(step.dx, 0) + drift[0] * moved,
          num(step.dy, 0) + drift[1] * moved,
          num(step.z, mark.z ?? 5),
        );
      }
    } else {
      // Round the head on a flat ring: in front on the near half, behind on the far one.
      const stars = Math.max(1, whole(step.count, 3));
      const per = Math.max(4, whole(step.per, 12));
      const rx = num(step.rx, 8);
      const ry = num(step.ry, 2);
      for (let i = 0; i < count; i++)
        for (let s = 0; s < stars; s++) {
          const angle = ((i / per + s / stars) % 1) * 2 * Math.PI;
          stamp(
            mark,
            attach,
            from + i,
            num(step.dx, 0) + Math.cos(angle) * rx,
            num(step.dy, 0) + Math.sin(angle) * ry,
            Math.sin(angle) > -1e-9 ? 5 : -1,
          );
        }
    }
  }

  if (frames.length === 0) problems.push("a score with no frames");
  return {
    frames: frames.map(({ pose, layers }) => (layers.length > 0 ? { pose, layers } : { pose })),
    tell,
    problems,
  };
}
