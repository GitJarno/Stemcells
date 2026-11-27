/**
 * The motion system's timed primitives (`stemcells/docs/motion.md`), first made for the Cells'
 * lists (stemcells/tasks/sleep-motion.md): move, enter, leave. Plain numbers so the phone reads
 * them too; each is a token of `tokens/stemcells.css`, held there by `listMotion.test.ts`.
 */

import { springAt } from "../tokens/spring.ts";

/** `--sc-motion-recede`: an ease out, which never overshoots. */
const RECEDE = { duration: 350, easing: [0, 0, 0.58, 1] } as const;

export const LIST_MOTION = {
  /** A row gliding to its new slot, a row folding away, and a Cell flying to its count. */
  move: RECEDE,
  /** Anything new fading in where it landed: `--sc-motion-fade`. */
  enter: { duration: 200, easing: [0, 0, 0.58, 1] },
  /** Anything going fading out where it stood, quicker than it came: `--sc-motion-leave`. */
  leave: { duration: 140, easing: [0.42, 0, 1, 1] },
  /** Its light rising over the row's own and going: up quickly, down slowly. */
  bloom: { rise: 250, fall: 650 },
  /** The count taking a Cell, one small bump: `--sc-motion-settle`'s length. */
  tick: { duration: 419 },
  /** More rows than this entering at once is a list read again (a pick, a page), not arrivals. */
  mostAtOnce: 4,
  /**
   * Sleep's leave: the Cell leaps from where it stands and drops into Asleep's count. Physics,
   * not a curve: one gravity times the way up and the way down, so they read as one arc, and its
   * way across slows as if through air, so it is over the count by its top and drops in.
   */
  leap: {
    /** The crouch before it springs from rest (ms), and how far it squashes there. */
    crouch: 90,
    squash: 0.12,
    /** How high its top stands over the higher end: its own heights, plus a share of the way. */
    rise: 0.9,
    riseAlong: 0.03,
    riseMost: 56,
    /** Points (px) per second². */
    gravity: 6400,
    /** Its time in the air, ms, held between these whatever the way's length. */
    air: { least: 360, most: 540 },
    /** How much it stretches along its way, at launch and as it comes down. */
    stretch: { up: 0.14, down: 0.16 },
    /** Degrees: it leans into the leap, and lies back as it falls asleep. */
    lean: 6,
    lie: 14,
    /** Its eyes close this long (ms) past the top. */
    eyes: 40,
    /**
     * At least this share of its way across is behind it as it rises past the count (or by its
     * top, from above): it drops in, never crossing the stages beside it.
     */
    overBy: 0.85,
    /** How hard its way across can slow: a drag's rate over its whole time in the air. */
    dragMost: 6,
    /**
     * A swipe throws it: past this speed (pt/s) it springs off its sliding row with no crouch,
     * keeping `carries` of the row's speed and stretching into the leap over `push` ms.
     */
    thrownLeast: 300,
    carries: 0.7,
    push: 40,
    /**
     * It touches down whole on what catches it (the count's middle line, or the bar's rim),
     * squashes `impact` as that gives under it, then sinks into the count over `sink` ms.
     */
    impact: 0.26,
    sink: 170,
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

/** Where a leap lands: the count it sinks into, and the top of what catches it, if not the count's middle. */
export interface LeapLanding extends LeapEnd {
  readonly surface?: number;
}

/** A leap's plan: its ends, its top's height, its moments in ms from the start, and its drag. */
export interface Leap {
  readonly from: LeapEnd;
  /** The count it sinks into: its middle, and the Cell's height there. */
  readonly to: LeapEnd;
  /** Where its middle stands as it touches down: its feet on what catches it. */
  readonly touch: { readonly x: number; readonly y: number };
  readonly top: number;
  readonly launch: number;
  readonly apex: number;
  readonly eyes: number;
  /** It touches down, and the count catches it. */
  readonly contact: number;
  readonly total: number;
  /** How its way across slows (`across`), 0 for none. */
  readonly drag: number;
  /** Thrown by a swipe: no crouch, a push off instead. */
  readonly thrown: boolean;
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

/** How much of its way across a leap with `drag` has come at `p` of its time in the air. */
function across(p: number, drag: number): number {
  return drag < 1e-3 ? p : (1 - Math.exp(-drag * p)) / (1 - Math.exp(-drag));
}

/** The least drag in [0, `most`] for which `reached(drag)` holds, if any does; `reached` grows. */
function leastDrag(reached: (drag: number) => boolean, most: number): number {
  if (reached(0)) return 0;
  if (!reached(most)) return most;
  let low = 0;
  let high = most;
  for (let n = 0; n < 24; n++) {
    const middle = (low + high) / 2;
    if (reached(middle)) high = middle;
    else low = middle;
  }
  return high;
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * A leap from `from` (where the Cell stands) into the count at `to`, which it sinks into at
 * `to.height`. `thrown` is the speed across (pt/s, + rightward) of the row a swipe let go.
 */
export function leapOf(from: LeapEnd, to: LeapLanding, thrown = 0): Leap {
  const L = LIST_MOTION.leap;
  const flung = Math.abs(thrown) > L.thrownLeast;
  const crouch = flung ? 0 : L.crouch;
  const touch = { x: to.x, y: (to.surface ?? to.y) - to.height / 2 };
  const length = Math.hypot(touch.x - from.x, touch.y - from.y);
  const top =
    Math.min(from.y, touch.y) - Math.min(from.height * L.rise + length * L.riseAlong, L.riseMost);
  const up = Math.sqrt(from.y - top);
  const down = Math.sqrt(touch.y - top);
  // Falling a height h takes √(2h / g): up and down are each a fall from the top.
  const natural = (up + down) * Math.sqrt(2 / L.gravity) * 1000;
  const flying = Math.min(Math.max(natural, L.air.least), L.air.most);
  const topAt = up / (up + down);
  const dx = touch.x - from.x;
  // Over the count by the time it rises past it (its top, from above), so it never crosses the
  // stages beside it; and as fast across as the row it left: whichever needs more.
  const level = touch.y + to.height;
  const passing = level < from.y ? topAt * (1 - Math.sqrt((level - top) / (from.y - top))) : topAt;
  const over = leastDrag((drag) => across(passing, drag) >= L.overBy, L.dragMost);
  const speed = (thrown * L.carries * flying) / 1000 / dx;
  const kept =
    flung && speed > 1 ? leastDrag((drag) => drag / (1 - Math.exp(-drag)) >= speed, L.dragMost) : 0;
  const apex = crouch + flying * topAt;
  const contact = crouch + flying;
  return {
    from,
    to,
    touch,
    top,
    launch: crouch,
    apex,
    eyes: apex + L.eyes,
    contact,
    total: contact + L.sink,
    drag: Math.max(over, kept),
    thrown: flung,
  };
}

/** Where the Cell of `leap` stands `ms` after its leap began. */
export function leapAt(leap: Leap, ms: number): LeapPose {
  const { squash, stretch, lean, lie, push, impact, sink } = LIST_MOTION.leap;
  const { from, to, touch, top, launch, apex, contact } = leap;
  const way = touch.x < from.x ? -1 : 1;
  const landing = to.height / from.height;
  if (ms < launch) {
    const c = (squash * (1 - Math.cos((Math.PI * Math.max(ms, 0)) / launch))) / 2;
    // Squashed from its feet, which stay on the ground.
    const y = from.y + (from.height * c) / 2;
    return { x: from.x, y, scaleX: 1 + c, scaleY: 1 - c, rotate: 0, opacity: 1 };
  }
  if (ms >= contact) {
    // Down: it lands long, squashes as the count gives, then sinks into it, upright.
    const s = Math.min(1, (ms - contact) / sink);
    const d =
      s < 0.2
        ? stretch.down + (-impact - stretch.down) * smooth(s / 0.2)
        : -impact * (1 - smooth((s - 0.2) / 0.3));
    const size = landing * (1 - 0.85 * s * s);
    return {
      x: touch.x,
      y: touch.y + (to.y - touch.y) * smooth(s) - (to.height * Math.min(d, 0)) / 2,
      scaleX: size / (1 + d),
      scaleY: size * (1 + d),
      rotate: -way * lie * (1 - smooth(s / 0.4)),
      opacity: s < 0.35 ? 1 : 1 - smooth((s - 0.35) / 0.65),
    };
  }
  const air = contact - launch;
  const p = (ms - launch) / air;
  const topAt = (apex - launch) / air;
  const rising = p < topAt;
  // What's left of its launch speed going up, and how far into its fall coming down.
  const left = rising ? 1 - p / topAt : 0;
  const fall = rising ? 0 : (p - topAt) / (1 - topAt);
  const size = 1 + (landing - 1) * fall * fall;
  // Thrown, it stretches into the leap as it leaves its row rather than from a crouch.
  const pushed = leap.thrown ? Math.min(1, ms / push) : 1;
  const stretched = 1 + (rising ? stretch.up * left * pushed : stretch.down * fall);
  return {
    x: from.x + (touch.x - from.x) * across(p, leap.drag),
    y: top + (from.y - top) * ((p - topAt) / topAt) ** 2,
    scaleX: size / stretched,
    scaleY: size * stretched,
    rotate: rising ? way * lean * left * pushed : -way * lie * fall * (2 - fall),
    opacity: 1,
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
