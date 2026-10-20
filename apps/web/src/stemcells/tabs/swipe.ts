/**
 * A two-finger swipe, read from wheel events. The trackpad reports each
 * gesture in two parts: the fingers moving, then, once they lift, the
 * system's coast (momentum), which keeps scrolling with a decaying speed.
 * The pager follows the fingers and lets go when they lift, so it needs to
 * tell the two apart. DOM wheel events say neither which part an event
 * belongs to nor when the fingers lift; a `ContactSource` works it out.
 * `WheelContact` reads it from the deltas and their timing. A source that
 * reads the system's own phases can replace it without the pager changing.
 *
 * `SwipeLatch` then decides, once per gesture, whether the gesture is the
 * pager's: a horizontal move, not taken by a scroller under the fingers.
 */

/** One wheel event: its deltas in pixels (scroll direction) and its time in milliseconds. */
export interface WheelSample {
  readonly dx: number;
  readonly dy: number;
  readonly t: number;
}

/** Where a wheel event falls in its gesture. */
export type Contact =
  /** The fingers touched down: the first event of a new gesture. */
  | { readonly phase: "began" }
  /** The fingers are moving. */
  | { readonly phase: "moved" }
  /**
   * The fingers have lifted: this event is the coast's. `coasted` is what
   * the events just before it reported as the fingers' move but was the
   * coast already; it was told before the coast could be recognised.
   */
  | { readonly phase: "lifted"; readonly coasted: { readonly dx: number; readonly dy: number } }
  /** The coast after the fingers lifted, which the gesture ignores. */
  | { readonly phase: "coasting" };

/** Tells finger contact from the coast that follows it. */
export interface ContactSource {
  /** Places one wheel event in its gesture. */
  wheel(sample: WheelSample): Contact;
  /**
   * No wheel event has come since the last one: true when that silence, up
   * to `now`, means the fingers lifted. True once per gesture.
   */
  idle(now: number): boolean;
}

/** Silence this long (ms) between events means the fingers lifted, or never moved on. */
export const LIFT_GAP = 70;

/** A display frame at 60 Hz, the unit a coast's decay is measured in. */
const FRAME = 1000 / 60;
/** Events in a row that must decay smoothly before they count as a coast. */
const COAST_RUN = 5;
/** A coast keeps at least this share of its speed from one frame to the next… */
const COAST_DECAY_MIN = 0.75;
/** …and at most this: anything steadier is a finger still moving. */
const COAST_DECAY_MAX = 0.985;
/** How evenly a coast decays: the most its rate per frame varies within a run… */
const COAST_EVENNESS = 0.04;
/** …give or take, where deltas come in whole pixels, their rounding. Fingers slowing down vary more. */
const WHOLE_PIXEL = 0.5;
/** Below this speed (px per event) the deltas are too coarse to read a decay: such a coast passes for the fingers until it stops. */
const COAST_FLOOR = 2;
/** Events of a coast come at a display's cadence; further apart than this, the run isn't one. */
const COAST_MAX_INTERVAL = 34;

const speed = (sample: WheelSample): number => Math.hypot(sample.dx, sample.dy);

/** Whether `next` goes on in the direction of `previous` (either may be still). */
function sameWay(previous: WheelSample, next: WheelSample): boolean {
  const dot = previous.dx * next.dx + previous.dy * next.dy;
  const norms = speed(previous) * speed(next);
  return norms === 0 || dot / norms > 0.9;
}

/**
 * The rate per frame at which `run` decays, if it decays the way a coast
 * does: every event slower than the one before, the same way, at a steady
 * rate per frame, as the system's physics produces it. Null for anything
 * else; fingers slowing down jitter, a coast doesn't.
 */
export function coastRate(run: readonly WheelSample[]): number | null {
  if (run.length < 3 || speed(run[0]!) < COAST_FLOOR) return null;
  const whole = run.every((sample) => Number.isInteger(sample.dx) && Number.isInteger(sample.dy));
  const rates: number[] = [];
  let rounding = 0;
  for (let i = 1; i < run.length; i++) {
    const previous = run[i - 1]!;
    const next = run[i]!;
    const interval = next.t - previous.t;
    if (interval <= 0 || interval > COAST_MAX_INTERVAL || !sameWay(previous, next)) return null;
    const ratio = speed(next) / speed(previous);
    if (!(ratio > 0 && ratio <= 1)) return null;
    const perFrame = FRAME / interval;
    rates.push(ratio ** perFrame);
    // How far rounding each delta to a whole pixel can move this rate.
    if (whole) {
      const error = (WHOLE_PIXEL / speed(previous) + WHOLE_PIXEL / speed(next)) * perFrame;
      rounding = Math.max(rounding, error);
    }
  }
  const fastest = Math.min(...rates);
  const slowest = Math.max(...rates);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const steady =
    mean >= COAST_DECAY_MIN &&
    mean <= COAST_DECAY_MAX &&
    slowest < 1 + rounding &&
    slowest - fastest <= COAST_EVENNESS + rounding;
  return steady ? mean : null;
}

/** A coast under way: its first recognised event, and the rate it decays at. */
interface Coast {
  readonly from: WheelSample;
  readonly rate: number;
}

/**
 * Whether `next` carries on `coast`, whose last event was `previous`: soon
 * enough, the same way, and no faster than the coast would be by then
 * (give or take the coarse deltas at its tail). Anything else is a new
 * touch, which stops the coast.
 */
function carriesOn(coast: Coast, previous: WheelSample, next: WheelSample): boolean {
  const expected = speed(coast.from) * coast.rate ** ((next.t - coast.from.t) / FRAME);
  return (
    next.t - previous.t <= LIFT_GAP && sameWay(previous, next) && speed(next) <= expected * 1.25 + 1
  );
}

/**
 * Finger contact read from wheel events alone. A gesture begins with the
 * first event after a silence (or one that breaks a coast), and the fingers
 * lift at the first of: a silence of `LIFT_GAP`, or a run of events that
 * decays like a coast.
 */
export class WheelContact implements ContactSource {
  #last: WheelSample | null = null;
  /** Set while the fingers are down: their latest events, enough to recognise a coast's start. */
  #run: WheelSample[] | null = null;
  /** Set once the fingers lifted into a coast, until it ends. */
  #coast: Coast | null = null;

  wheel(sample: WheelSample): Contact {
    const last = this.#last;
    this.#last = sample;
    const touches =
      last === null ||
      sample.t - last.t > LIFT_GAP ||
      (this.#run === null && (this.#coast === null || !carriesOn(this.#coast, last, sample)));
    if (touches) {
      this.#run = [sample];
      this.#coast = null;
      return { phase: "began" };
    }
    if (this.#run === null) return { phase: "coasting" };
    this.#run.push(sample);
    if (this.#run.length > COAST_RUN) this.#run.shift();
    const rate = this.#run.length === COAST_RUN ? coastRate(this.#run) : null;
    if (rate === null) return { phase: "moved" };
    // The run's first event was the fingers' last; those after it, up to
    // this one, were the coast already.
    const coasted = this.#run.slice(1, -1);
    this.#coast = { from: this.#run[1]!, rate };
    this.#run = null;
    return {
      phase: "lifted",
      coasted: {
        dx: coasted.reduce((sum, s) => sum + s.dx, 0),
        dy: coasted.reduce((sum, s) => sum + s.dy, 0),
      },
    };
  }

  idle(now: number): boolean {
    if (this.#run === null || this.#last === null || now - this.#last.t <= LIFT_GAP) return false;
    // A coast that was under way is judged by its next event, which says
    // by its own time whether it carries on.
    this.#run = null;
    return true;
  }
}

/** The fingers must move this far (px) before a gesture is anyone's. */
export const LATCH_DISTANCE = 8;

/**
 * Who a gesture belongs to: undecided until it has moved `LATCH_DISTANCE`,
 * then the pager's (horizontal, nothing under the fingers scrolls that way),
 * or the page's (vertical, or a horizontal scroller with room takes it).
 * "spent" is a gesture the pager had and gave up, when the tabs turned by
 * other means while the fingers were down: the rest of it goes nowhere.
 */
export type SwipeOwner = "pending" | "pager" | "page" | "spent";

export class SwipeLatch {
  #owner: SwipeOwner = "pending";
  #dx = 0;
  #dy = 0;
  readonly #taken = new Map<1 | -1, boolean>();
  readonly #scroller: (direction: 1 | -1) => boolean;
  readonly #catching: boolean;

  /**
   * `scrollerTakes(direction)`: whether something under the fingers scrolls
   * that way (1: toward its end) and has room to. `catching`: the strip is
   * still moving from the last swipe, so a hand on it that leans horizontal
   * is catching it, and takes it at once.
   */
  constructor(scrollerTakes: (direction: 1 | -1) => boolean, options?: { catching?: boolean }) {
    this.#scroller = scrollerTakes;
    this.#catching = options?.catching === true;
  }

  get owner(): SwipeOwner {
    return this.#owner;
  }

  #scrollerTakes(direction: 1 | -1): boolean {
    let taken = this.#taken.get(direction);
    if (taken === undefined) {
      taken = this.#scroller(direction);
      this.#taken.set(direction, taken);
    }
    return taken;
  }

  /** The fingers moved: returns how far (px) that moves the pager, 0 unless the gesture is its. */
  move(dx: number, dy: number): number {
    if (this.#owner === "pager") return dx;
    if (this.#owner !== "pending") return 0;
    this.#dx += dx;
    this.#dy += dy;
    const across = Math.abs(this.#dx);
    if (this.#catching && across > Math.abs(this.#dy)) {
      this.#owner = "pager";
      return this.#dx;
    }
    if (Math.max(across, Math.abs(this.#dy)) <= LATCH_DISTANCE) return 0;
    const direction = this.#dx > 0 ? 1 : -1;
    if (across > Math.abs(this.#dy) && !this.#scrollerTakes(direction)) {
      this.#owner = "pager";
      // Tracking starts at the latch, so the strip doesn't jump by it.
      return this.#dx - direction * LATCH_DISTANCE;
    }
    this.#owner = "page";
    return 0;
  }

  /** The tabs turned by other means while the fingers were down. */
  spend(): void {
    if (this.#owner === "pager" || this.#owner === "pending") this.#owner = "spent";
  }

  /**
   * Whether the page must leave this gesture's events alone. Browsers let a
   * gesture's events be cancelled only if its first one was, so a gesture
   * that might still become the pager's is held from its first event: one
   * that leans horizontal and isn't a scroller's.
   */
  get holds(): boolean {
    if (this.#owner === "pager" || this.#owner === "spent") return true;
    if (this.#owner === "page") return false;
    if (Math.abs(this.#dx) < Math.abs(this.#dy)) return false;
    return this.#dx === 0 || !this.#scrollerTakes(this.#dx > 0 ? 1 : -1);
  }
}
