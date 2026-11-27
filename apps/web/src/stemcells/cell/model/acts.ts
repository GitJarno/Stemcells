// What the model does, as a pose over time. Every part of the pose rides a
// spring, so an act only says where things should be and the body gets there
// with its own weight: a squash before a reach, a wobble after a landing.

import { crownOf, type Eyes, keysOf, type Pose } from "./body.ts";
import type { Vec3 } from "./shapes.ts";

export type Act = "rest" | "thinking" | "writing" | "watching" | "asking" | "landed" | "asleep";

const AT_WORK: ReadonlySet<Act> = new Set(["thinking", "writing", "watching"]);

interface Spring {
  at: number;
  speed: number;
  to: number;
}

const spring = (at: number): Spring => ({ at, speed: 0, to: at });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const ease = (from: number, to: number, x: number) => {
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** How stiff and how damped each part's spring is; a limb takes `LIMB`. */
const LIMB = [210, 19] as const;
const SPRINGS: Readonly<Record<string, readonly [number, number]>> = {
  squash: [170, 16],
  gazeX: [260, 24],
  gazeY: [260, 24],
  lift: [85, 13],
  glow: [120, 22],
  laptop: [240, 15],
  lid: [240, 15],
  sway: [90, 6],
};

/** A Cell's body in time: `play` an act, `step` to now, and read its pose. */
export function performerOf(grown: number, seed = 0) {
  const parts = {
    squash: spring(1),
    lift: spring(0),
    armLeft: spring(0),
    armRight: spring(0),
    leftX: spring(-0.9),
    leftY: spring(0.4),
    leftZ: spring(0),
    rightX: spring(0.9),
    rightY: spring(0.4),
    rightZ: spring(0),
    laptop: spring(0),
    lid: spring(0),
    glow: spring(0),
    gazeX: spring(0),
    gazeY: spring(0),
    sway: spring(0),
  };
  let act: Act = "rest";
  let since = 0;
  let entered = -1e9;
  let blinkAt: number | undefined;
  let blinks = 0;
  let scroll = 0;
  const done = new Set<string>();
  const once = (mark: string) => (done.has(mark) ? false : (done.add(mark), true));

  const play = (next: Act, now: number) => {
    since = now;
    done.clear();
    if (next === act) return;
    if (AT_WORK.has(next) && !AT_WORK.has(act) && act !== "asking") entered = now;
    if (next === "asking") parts.squash.speed -= 1.6;
    act = next;
  };

  const step = (now: number, seconds: number): Pose => {
    const elapsed = now - since;
    const sinceEntered = now - entered;
    const s = now / 1000;
    const breath = Math.sin(s * 1.25 + seed * 6.283);
    const bob = Math.sin(s * 1.96 + seed * 6.283) * 0.04;
    const crown = crownOf(grown);
    const hanging = ease(0.5, 0.9, grown);
    const side = lerp(0.95, 0.56, grown);
    const low = lerp(0.45, 0.4, grown);

    let squash = 1 + breath * 0.018;
    let lift = 0;
    let arms: [number, number] = [hanging, hanging];
    let left: Vec3 = [-side, low, 0.05];
    let right: Vec3 = [side, low, 0.05];
    let laptop = 0;
    let lid = 0;
    let glow = 0;
    let gaze: [number, number] = [0, 0];
    let eyes: Eyes = "open";
    let hop = 0;

    if (AT_WORK.has(act)) {
      laptop = 1;
      lid = 1;
      glow = 1;
      lift = 0.2 + bob;
      squash = 1.04 + breath * 0.01;
      gaze = [0, -0.7];
      if (act === "thinking") {
        glow = 0.4;
        lift = 0.24 + bob * 1.3;
        gaze = [-0.5 + Math.sin(s * 0.9) * 0.3, 0.8];
        if (elapsed % 5200 > 3900) {
          arms = [hanging, 1];
          right = [lerp(0.6, 0.5, grown) + Math.sin(s * 20) * 0.05, crown - 0.08, 0.25];
        }
      } else if (act === "watching") {
        glow = 0.75 + 0.25 * Math.sin(s * 31) * Math.sin(s * 13);
        squash = 0.99 + breath * 0.01;
        gaze = [Math.sin(s * 1.3) * 0.5, -0.7];
      } else {
        const tap = Math.max(0, Math.sin(s * 24));
        const other = Math.max(0, Math.sin(s * 24 + Math.PI));
        const [lx, ly, lz] = keysOf(grown, -1);
        const [rx, ry, rz] = keysOf(grown, 1);
        arms = [1, 1];
        left = [lx, ly + tap * 0.09, lz];
        right = [rx, ry + other * 0.09, rz];
        gaze = [Math.sin(s * 2.1) * 0.3, -0.7];
        scroll += seconds * 7;
      }
      // It pulls the laptop out: a squash, a stretch as it comes up shut, then the lid and the light.
      if (sinceEntered < 160) {
        squash = 0.84;
        laptop = 0;
        lid = 0;
        glow = 0;
        lift = 0;
        gaze = [0, -0.4];
        arms = [0.5, 0.5];
      } else if (sinceEntered < 400) {
        squash = 1.13;
        lid = 0;
        glow = 0;
        lift = 0;
        gaze = [0, -0.9];
        arms = [1, 1];
        left = keysOf(grown, -1);
        right = keysOf(grown, 1);
      } else if (sinceEntered < 600) {
        glow = 0.6;
        lift = 0.06;
        gaze = [0, gaze[1]];
      }
    } else if (act === "asking") {
      laptop = 1;
      lid = 0.32;
      glow = 0.15;
      squash = 1.03;
      gaze = [0, 0.25];
      eyes = elapsed % 1060 < 530 ? "ask" : "hidden";
      if (elapsed % 3200 < 1400) {
        arms = [hanging, 1];
        right = [lerp(1.12, 0.86, grown) + Math.sin(s * 17) * 0.13, crown - 0.12, 0.15];
      }
    } else if (act === "landed" && elapsed < 2800) {
      eyes = "glad";
      gaze = [0, 0.1];
      if (elapsed < 140) {
        laptop = 1;
        squash = 0.95;
      } else if (elapsed < 330) {
        squash = 0.8;
      } else {
        const first = (elapsed - 330) / 1000;
        const second = first - 0.46;
        hop = Math.max(
          0,
          2.7 * first - 6.6 * first * first,
          second > 0 ? 1.7 * second - 6.6 * second * second : 0,
        );
        if (elapsed < 1600) {
          const up = lerp(1.08, 0.8, grown);
          arms = [1, 1];
          left = [-up, crown + 0.05, 0];
          right = [up, crown + 0.05, 0];
        }
        if (hop > 0.02) squash = 1.1;
        if (first > 0.41 && once("first")) parts.squash.speed -= 2.4;
        if (second > 0.26 && once("second")) parts.squash.speed -= 1.4;
      }
    } else if (act === "asleep") {
      squash = 0.9 + Math.sin(s * 0.95 + seed * 6.283) * 0.02;
      eyes = "shut";
      gaze = [0, -0.3];
    } else if (s % 7 < 1.3) {
      gaze = [0.6, 0.15];
    }

    blinkAt ??= now + 1500 + seed * 3000;
    if (eyes === "open" && now > blinkAt) {
      eyes = "shut";
      if (now > blinkAt + 150) {
        blinks++;
        blinkAt =
          now + 2600 + (Math.abs(Math.sin(seed * 91.7 + blinks * 7.3) * 43758.5) % 1) * 3200;
      }
    }

    const to = {
      squash,
      lift,
      armLeft: arms[0],
      armRight: arms[1],
      leftX: left[0],
      leftY: left[1],
      leftZ: left[2],
      rightX: right[0],
      rightY: right[1],
      rightZ: right[2],
      laptop,
      lid,
      glow,
      gazeX: gaze[0],
      gazeY: gaze[1],
      sway: 0,
    };
    const steps = Math.max(1, Math.ceil(seconds / 0.008));
    const each = seconds / steps;
    const wasFalling = parts.squash.speed;
    for (const [name, part] of Object.entries(parts)) {
      part.to = to[name as keyof typeof to];
      const [stiff, damp] = SPRINGS[name] ?? LIMB;
      for (let i = 0; i < steps; i++) {
        part.speed += (stiff * (part.to - part.at) - damp * part.speed) * each;
        part.at += part.speed * each;
      }
    }
    parts.sway.speed -= (parts.squash.speed - wasFalling) * 0.02;

    return {
      grown,
      squash: clamp(parts.squash.at, 0.6, 1.6),
      lift: Math.max(0, parts.lift.at) + hop,
      arms: [clamp(parts.armLeft.at, 0, 1.1), clamp(parts.armRight.at, 0, 1.1)],
      hands: [
        [parts.leftX.at, parts.leftY.at, parts.leftZ.at],
        [parts.rightX.at, parts.rightY.at, parts.rightZ.at],
      ],
      laptop: clamp(parts.laptop.at, 0, 1.1),
      lid: clamp(parts.lid.at, 0, 1.1),
      glow: clamp(parts.glow.at, 0, 1.5),
      gaze: [clamp(parts.gazeX.at, -1, 1), clamp(parts.gazeY.at, -1, 1)],
      eyes,
      sway: clamp(parts.sway.at, -0.2, 0.2),
      scroll,
    };
  };

  return { play, step };
}

/** Whether a picture of `to` would differ from one of `from`, where a pixel shows `pixel` of the world. */
export function moved(from: Pose, to: Pose, pixel: number): boolean {
  const far = (a: number, b: number, weight = 1) => Math.abs(a - b) * weight > pixel / 2;
  return (
    from.eyes !== to.eyes ||
    Math.floor(from.scroll) !== Math.floor(to.scroll) ||
    far(from.squash, to.squash, 1.25) ||
    far(from.lift, to.lift) ||
    far(from.laptop, to.laptop) ||
    far(from.lid, to.lid, 0.5) ||
    far(from.glow, to.glow, 0.2) ||
    far(from.sway, to.sway) ||
    far(from.gaze[0], to.gaze[0], 0.08) ||
    far(from.gaze[1], to.gaze[1], 0.04) ||
    from.arms.some((arm, side) => far(arm, to.arms[side]!, 0.5)) ||
    from.hands.some((hand, side) => hand.some((at, axis) => far(at, to.hands[side]![axis]!)))
  );
}

/** The pose `ms` into `act`, played from rest (or from `from`, held four seconds first). */
export function poseAt(act: Act, ms: number, grown: number, from?: Act): Pose {
  const performer = performerOf(grown);
  let now = 0;
  let pose = performer.step(now, 1 / 60);
  const run = (until: number) => {
    while (now < until) {
      now += 1000 / 60;
      pose = performer.step(now, 1 / 60);
    }
  };
  if (from !== undefined) {
    performer.play(from, now);
    run(4000);
  }
  performer.play(act, now);
  run(now + ms);
  return pose;
}
