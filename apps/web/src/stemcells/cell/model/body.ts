// A pose in, the model out: the body's shapes, its laptop and what it wears,
// with the places the sprite needs to find again (the head, the eyes, the lid).

import {
  arch,
  box,
  cap,
  capsule,
  ellipsoid,
  ring,
  type Scene,
  type Shape,
  type Vec3,
} from "./shapes.ts";
import { TONE } from "./tones.ts";

export type Eyes = "open" | "shut" | "glad" | "ask" | "hidden";

export const PIECES = ["beanie", "headphones", "scarf", "backpack", "specs"] as const;

export type Piece = (typeof PIECES)[number];

export const isPiece = (word: string): word is Piece => PIECES.some((piece) => piece === word);

export interface Pose {
  /** 0 a newborn mound, 1 a grown figure with a head, arms and feet. */
  readonly grown: number;
  /** Its height against rest; the width follows, so the volume holds. */
  readonly squash: number;
  /** How high it is off the floor. */
  readonly lift: number;
  /** How far each arm has grown, left then right, and where each hand is. */
  readonly arms: readonly [number, number];
  readonly hands: readonly [Vec3, Vec3];
  /** The laptop: 0 put away to 1 out, its lid 0 shut to 1 open, its screen's light. */
  readonly laptop: number;
  readonly lid: number;
  readonly glow: number;
  readonly gaze: readonly [number, number];
  readonly eyes: Eyes;
  /** How far what hangs has swung. */
  readonly sway: number;
  /** Lines the screen has scrolled. */
  readonly scroll: number;
}

export interface Lid {
  readonly at: Vec3;
  readonly sin: number;
  readonly cos: number;
  readonly half: number;
  readonly glow: number;
}

export interface Figure extends Scene {
  readonly pose: Pose;
  readonly worn: readonly Piece[];
  readonly head: Vec3;
  readonly headRadii: Vec3;
  /** Where an eye sits on the head, in the head's own radii. */
  readonly eye: readonly [number, number];
  readonly lid: Lid | undefined;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const ease = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** Where the laptop stands before the body's lift: its height and how far in front. */
const deskOf = (grown: number) => ({
  height: lerp(0.1, 0.56, grown),
  ahead: lerp(1.3, 0.76, grown),
});

/** Where a hand rests on the keys, `side` -1 the left. */
export const keysOf = (grown: number, side: number): Vec3 => {
  const desk = deskOf(grown);
  return [side * lerp(0.34, 0.2, grown), desk.height + lerp(0.06, 0.08, grown), desk.ahead - 0.1];
};

/** The top of the head at rest, before squash and lift. */
export const crownOf = (grown: number) => lerp(1.25, 1.8, grown);

export function figureOf(pose: Pose, worn: readonly Piece[] = []): Figure {
  const { grown, squash, lift } = pose;
  const wide = 1 / Math.sqrt(squash);
  const placed = (x: number, y: number, z: number): Vec3 => [x * wide, y * squash + lift, z * wide];

  const head = placed(0, lerp(0.38, 1.22, grown), 0);
  const headRadii: Vec3 = [
    lerp(1, 0.64, grown) * wide,
    lerp(0.87, 0.58, grown) * squash,
    lerp(0.9, 0.6, grown) * wide,
  ];
  const torso = placed(0, lerp(0.3, 0.5, grown), 0);
  const torsoRadii: Vec3 = [
    lerp(0.85, 0.4, grown) * wide,
    lerp(0.3, 0.44, grown) * squash,
    lerp(0.75, 0.34, grown) * wide,
  ];
  const eye = [lerp(0.36, 0.34, grown), lerp(0.41, -0.04, grown)] as const;

  const body: Shape[] = [
    ellipsoid(head, headRadii, TONE.body),
    ellipsoid(torso, torsoRadii, TONE.body),
  ];
  const feet = ease(0.3, 0.8, grown);
  if (feet > 0.05)
    for (const side of [-1, 1])
      body.push(
        ellipsoid(
          [side * 0.21 * wide, lift + 0.08, 0.1],
          [0.17 * feet, 0.11 * feet, 0.25 * feet],
          TONE.body,
        ),
      );
  for (const side of [0, 1] as const) {
    const out = pose.arms[side];
    if (out <= 0.04) continue;
    const sign = side === 0 ? -1 : 1;
    const shoulder = placed(sign * lerp(0.8, 0.4, grown), lerp(0.42, 0.74, grown), 0);
    const target = pose.hands[side];
    const hand = placed(target[0], target[1], target[2]);
    const reach = Math.min(out, 1);
    body.push(
      capsule(
        shoulder,
        [
          shoulder[0] + (hand[0] - shoulder[0]) * reach,
          shoulder[1] + (hand[1] - shoulder[1]) * reach,
          shoulder[2] + (hand[2] - shoulder[2]) * reach,
        ],
        lerp(0.15, 0.09, grown) * Math.min(1, out * 1.4),
        TONE.body,
      ),
    );
  }

  const things: Shape[] = [];
  let lid: Lid | undefined;
  if (pose.laptop > 0.03) {
    const desk = deskOf(grown);
    const y = desk.height + lift + (pose.laptop - 1) * 0.8;
    const turn = Math.PI / 2 - pose.lid * 1.85;
    const half = lerp(0.2, 0.27, grown);
    const at: Vec3 = [
      0,
      y + 0.035 + Math.cos(turn) * half,
      desk.ahead + 0.26 - Math.sin(turn) * half,
    ];
    things.push(box([0, y, desk.ahead], [0.46, 0.03, 0.28], 0.025, TONE.metal));
    things.push(box(at, [0.46, half, 0.024], 0.02, TONE.lid, turn));
    lid = { at, sin: Math.sin(turn), cos: Math.cos(turn), half, glow: pose.glow };
  }

  if (worn.includes("beanie")) {
    const brim = head[1] + (eye[1] + 0.3) * headRadii[1];
    const grownBy = (by: number): Vec3 => [headRadii[0] * by, headRadii[1] * by, headRadii[2] * by];
    things.push(cap(head, grownBy(1.07), brim, 1e9, TONE.navy));
    things.push(cap(head, grownBy(1.13), brim, brim + 0.15, TONE.navyFold));
    things.push(
      ellipsoid(
        [head[0] + pose.sway, head[1] + headRadii[1] * 1.07 + 0.07, head[2]],
        [0.14, 0.14, 0.14],
        TONE.cream,
      ),
    );
  }
  if (worn.includes("headphones")) {
    things.push(arch(head, headRadii[0] * 1.07, headRadii[1] * 1.1, 0.05, TONE.graphite));
    for (const side of [-1, 1])
      things.push(
        ellipsoid(
          [head[0] + side * headRadii[0] * 1.03, head[1] - 0.02, head[2]],
          [0.11, 0.21, 0.21],
          TONE.graphite,
        ),
      );
  }
  if (worn.includes("scarf")) {
    const y = lerp(0.5, 0.93, grown) * squash + lift;
    const round = lerp(0.95, 0.42, grown) * wide;
    things.push(ring([0, y, 0], round, 0.1, TONE.red));
    things.push(
      capsule(
        [-0.3, y, round * 0.92],
        [-0.36 + pose.sway * 0.8, y - 0.36, round * 0.92 + 0.06],
        0.085,
        TONE.red,
      ),
    );
  }
  if (worn.includes("backpack")) {
    const y = torso[1] + lerp(0.2, 0.1, grown);
    const behind = -(lerp(0.9, 0.34, grown) * wide) - 0.1;
    things.push(box([0, y, behind], [lerp(0.42, 0.3, grown), 0.3, 0.16], 0.09, TONE.leather));
    things.push(
      box([0, y + 0.14, behind - 0.03], [lerp(0.44, 0.32, grown), 0.13, 0.17], 0.08, TONE.tan),
    );
  }

  return {
    pose,
    worn,
    body,
    things,
    melt: lerp(0.16, 0.09, grown),
    floor: lift,
    tuck: lerp(0.2, 0.03, grown),
    head,
    headRadii,
    eye,
    lid,
  };
}
