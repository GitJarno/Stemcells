/**
 * Every row of the Cells' lists, Mac and phone, moves in three ways only (stemcells/tasks/
 * sleep-motion.md): move, enter, leave. Plain numbers so the phone reads them too; each is a
 * token of `tokens/stemcells.css`, held there by `listMotion.test.ts`.
 */

import { springAt } from "../tokens/spring.ts";

/** `--sc-motion-recede`: an ease out, which never overshoots. */
const RECEDE = { duration: 350, easing: [0, 0, 0.58, 1] } as const;

export const LIST_MOTION = {
  /** A row gliding to its new slot, a row folding away, and a Cell flying to its count. */
  move: RECEDE,
  leave: RECEDE,
  /** A row fading in where it landed: `--sc-motion-fade`. */
  enter: { duration: 200, easing: [0, 0, 0.58, 1] },
  /** Its light rising over the row's own and going: up quickly, down slowly. */
  bloom: { rise: 250, fall: 650 },
  /** The count taking a Cell, one small bump: `--sc-motion-settle`'s length. */
  tick: { duration: 419 },
  /** More rows than this entering at once is a list read again (a pick, a page), not arrivals. */
  mostAtOnce: 4,
  /**
   * Sleep's leave: the Cell leaps from where it stands and falls into Asleep's count. Physics,
   * not a curve: one gravity times the way up and the way down, so they read as one arc.
   */
  leap: {
    /** The crouch before it springs (ms), and how far it squashes there. */
    crouch: 90,
    squash: 0.12,
    /** How high its top stands over the higher end: its own heights, plus a share of the way. */
    rise: 1.6,
    riseAlong: 0.05,
    riseMost: 90,
    /** Points (px) per second². */
    gravity: 6400,
    /** Its time in the air, ms, held between these whatever the way's length. */
    air: { least: 380, most: 560 },
    /** How much it stretches along its way, at launch and at landing. */
    stretch: { up: 0.14, down: 0.18 },
    /** Degrees: it leans into the leap, and lies back as it falls asleep. */
    lean: 6,
    lie: 14,
    /** Its eyes close this long (ms) past the top. */
    eyes: 40,
    /** The share of its time in the air it takes to go into the count. */
    fade: 0.1,
  },
  /**
   * Asleep catching it, `--sc-motion-catch`: the count gives under the landing (`give` ms,
   * slowing), then a soft spring brings it back past its place and to rest, like a hammock.
   */
  catch: { give: 80, response: 0.36, damping: 0.5 },
} as const;

/** A Cell's middle and its height, in window points (px on the Mac). */
export interface LeapEnd {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

/** A leap's plan: its ends, its top's height, and its moments in ms from the crouch. */
export interface Leap {
  readonly from: LeapEnd;
  readonly to: LeapEnd;
  readonly top: number;
  readonly launch: number;
  readonly apex: number;
  readonly eyes: number;
  readonly total: number;
}

/** Where a leaping Cell stands at a moment: its middle, its scale each way, its tilt, its opacity. */
export interface LeapPose {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotate: number;
  readonly opacity: number;
}

/** A leap from `from` (where the Cell stands) into the count at `to`, which it lands at `to.height`. */
export function leapOf(from: LeapEnd, to: LeapEnd): Leap {
  const { crouch, rise, riseAlong, riseMost, gravity, air, eyes } = LIST_MOTION.leap;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const top = Math.min(from.y, to.y) - Math.min(from.height * rise + length * riseAlong, riseMost);
  const up = Math.sqrt(from.y - top);
  const down = Math.sqrt(to.y - top);
  // Falling a height h takes √(2h / g): up and down are each a fall from the top.
  const natural = (up + down) * Math.sqrt(2 / gravity) * 1000;
  const flying = Math.min(Math.max(natural, air.least), air.most);
  const apex = crouch + (flying * up) / (up + down);
  return { from, to, top, launch: crouch, apex, eyes: apex + eyes, total: crouch + flying };
}

/** Where the Cell of `leap` stands `ms` after its crouch began. */
export function leapAt(leap: Leap, ms: number): LeapPose {
  const { squash, stretch, lean, lie, fade } = LIST_MOTION.leap;
  const { from, to, top, launch, apex, total } = leap;
  if (ms < launch) {
    const c = (squash * (1 - Math.cos((Math.PI * Math.max(ms, 0)) / launch))) / 2;
    // Squashed from its feet, which stay on the ground.
    const y = from.y + (from.height * c) / 2;
    return { x: from.x, y, scaleX: 1 + c, scaleY: 1 - c, rotate: 0, opacity: 1 };
  }
  const air = total - launch;
  const p = (Math.min(ms, total) - launch) / air;
  const topAt = (apex - launch) / air;
  const rising = p < topAt;
  // What's left of its launch speed going up, and how far into its fall coming down.
  const left = rising ? 1 - p / topAt : 0;
  const fall = rising ? 0 : (p - topAt) / (1 - topAt);
  const size = 1 + (to.height / from.height - 1) * fall * fall;
  const stretched = 1 + (rising ? stretch.up * left : stretch.down * fall);
  const way = to.x < from.x ? -1 : 1;
  return {
    x: from.x + (to.x - from.x) * p,
    y: top + (from.y - top) * ((p - topAt) / topAt) ** 2,
    scaleX: size / stretched,
    scaleY: size * stretched,
    rotate: rising ? way * lean * left : -way * lie * fall * (2 - fall),
    opacity: p < 1 - fade ? 1 : (1 - p) / fade,
  };
}

/** The leap's poses at even steps of about `step` ms, its last as it lands: keyframes, or a table. */
export function leapFrames(leap: Leap, step = 1000 / 60) {
  const n = Math.max(1, Math.ceil(leap.total / step));
  const poses = Array.from({ length: n + 1 }, (_, k) => leapAt(leap, (leap.total * k) / n));
  return { step: leap.total / n, poses };
}

/** How far down the count stands `ms` after the Cell landed in it: 1 at the bottom, below 0 rebounding. */
export function catchAt(ms: number): number {
  const { give } = LIST_MOTION.catch;
  if (ms <= 0) return 0;
  if (ms < give) return Math.sin(((Math.PI / 2) * ms) / give);
  return 1 - springAt(LIST_MOTION.catch, (ms - give) / 1000);
}

/** How long the catch moves, ms: until its swing is under a hundredth of its give. */
export function catchLength(): number {
  const { give, response, damping } = LIST_MOTION.catch;
  const decay = (damping * 2 * Math.PI) / response;
  return Math.ceil(give + (Math.log(100 / Math.sqrt(1 - damping * damping)) / decay) * 1000);
}

export type Bezier = readonly [number, number, number, number];

/** A curve as CSS writes it. */
export const cssEasing = (easing: Bezier): string => `cubic-bezier(${easing.join(", ")})`;

/** A reading of a list: what it was a view of (the picks, the machines heard from), and its rows. */
export interface ListReading {
  readonly view: string;
  readonly keys: ReadonlySet<string>;
}

/**
 * The rows that entered a list since its reading `before`: none at its first reading or in
 * another view (the list read again), and none when more than `mostAtOnce` came at once.
 */
export function enteredRows(
  before: ListReading | null,
  view: string,
  after: ReadonlyArray<string>,
): string[] {
  if (before === null || before.view !== view) return [];
  const entered = after.filter((key) => !before.keys.has(key));
  return entered.length > LIST_MOTION.mostAtOnce ? [] : entered;
}
