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
  /**
   * Until when (ms) the page could hear wheel events before this one: the
   * last frame it drew. A page busy rendering hears nothing, and the
   * browser then hands it everything that came meanwhile as one event,
   * stamped with the last one's time. So a gap between events is a silence
   * only up to here; after it, the page was busy. Absent: it heard all along.
   */
  readonly heard?: number | undefined;
  /**
   * When (ms) the page got this event. The browser hands the page one
   * wheel event at a time; while it holds one back, those after it wait,
   * and reach the page merged. Absent: as soon as it came.
   */
  readonly got?: number | undefined;
}

/** Where a wheel event falls in its gesture. */
export type Contact =
  /**
   * The fingers touched down: the first event of a new gesture. `lifts`:
   * it was their last move as well, and they have lifted since.
   */
  | { readonly phase: "began"; readonly lifts?: boolean }
  /**
   * The fingers are moving. `resumed`: they never lifted after all, where
   * a silence was told a lift (`ContactSource.idle`); the events in it had
   * been held back. `lifts`: this was their last move, and they have
   * lifted since (a source that knows, `PhasedContact`).
   */
  | { readonly phase: "moved"; readonly resumed?: boolean; readonly lifts?: boolean }
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
   * to `now`, means the fingers lifted. True once per silence; the next
   * event may yet say the gesture went on (`resumed`).
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
/**
 * How far a coast's next event may stray from the distance the coast
 * covers over the events due in its time: at most this many times it, at a
 * rate per frame up to `COAST_DRIFT_UP` slower to decay than the one read…
 */
const COAST_MOST = 1.5;
const COAST_DRIFT_UP = 0.03;
/** …and at least this share of it, at a rate up to `COAST_DRIFT_DOWN` quicker. */
const COAST_LEAST = 0.4;
const COAST_DRIFT_DOWN = 0.08;
/** Either way, give or take this (px): deltas come whole, and a coast's tail is a pixel an event. */
const COAST_SLACK = 2;
/** Events this many times further apart than the fingers' came at another pace: the coast's. */
const CADENCE_CHANGE = 1.6;
/** How far (a share) a merged event's distance may stray from the coast steps it stands for. */
const MERGED_SPREAD = 0.35;
/** A coast whose step has decayed below this (px) has stopped: what comes after it is new. */
const COAST_STOPPED = 0.25;
/**
 * A touch's first event moves at most about this far (px): the browser
 * never merges it with another, and fingers start slow. One larger after a
 * silence carries moves the page didn't hear.
 */
const TOUCH_START = 16;
/** A merged event of the fingers' covers at least this share of their pace before it over its gap. */
const PACE_SHARE = 0.5;
/** An event the page got this long (ms) after it came was held back, and may carry what came before it. */
const HELD = 3 * FRAME;

const speed = (sample: WheelSample): number => Math.hypot(sample.dx, sample.dy);

/** Whether `next` goes on in the direction of `previous` (either may be still). */
function sameWay(previous: WheelSample, next: WheelSample): boolean {
  const dot = previous.dx * next.dx + previous.dy * next.dy;
  const norms = speed(previous) * speed(next);
  return norms === 0 || dot / norms > 0.9;
}

/** Whether the browser held `sample` back (`HELD`). */
const heldBack = (sample: WheelSample): boolean =>
  sample.got !== undefined && sample.got - sample.t > HELD;

/**
 * Until when (ms) the page could hear events between `previous` and
 * `next`: up to `next`, unless it was too busy to (`next.heard`), or the
 * browser held events back: `previous` still when `next` came (within a
 * frame), or `next` itself. Then the page heard nothing after `previous`.
 */
function heardUntil(previous: WheelSample, next: WheelSample): number {
  const until = next.heard === undefined ? next.t : Math.min(next.t, next.heard + FRAME);
  const held = (previous.got !== undefined && next.t <= previous.got + FRAME) || heldBack(next);
  return held ? Math.min(until, previous.t + FRAME) : until;
}

/** How long (ms) the page heard nothing between `previous` and `next`: the gap, less any time it couldn't hear. */
function heardSilence(previous: WheelSample, next: WheelSample): number {
  return heardUntil(previous, next) - previous.t;
}

/** Whether `next` came after a stretch the page couldn't hear, carrying what came meanwhile. */
function mergedAfter(previous: WheelSample, next: WheelSample): boolean {
  return heardUntil(previous, next) < next.t && next.t - previous.t > COAST_MAX_INTERVAL;
}

/**
 * Whether `next` carries more than one step: most of a frame before it went
 * unheard (a coast's first event, a frame and a half after the fingers'
 * last, carries one).
 */
function carriesSteps(previous: WheelSample, next: WheelSample): boolean {
  return next.t - heardUntil(previous, next) > FRAME * 0.75;
}

/**
 * The rate per frame at which `run` decays, if it decays the way a coast
 * does: every event slower than the one before, the same way, at a steady
 * rate per frame, as the system's physics produces it. Null for anything
 * else; fingers slowing down jitter, a coast doesn't. An event that came
 * after the page was busy carries several of the coast's steps: the decay
 * is read across it, and its distance must be what those steps add up to.
 */
export function coastRate(run: readonly WheelSample[]): number | null {
  if (run.length < 3 || speed(run[0]!) < COAST_FLOOR) return null;
  const plain = run.filter((sample, i) => i === 0 || !mergedAfter(run[i - 1]!, sample));
  if (plain.length < 3) return null;
  const whole = plain.every((sample) => Number.isInteger(sample.dx) && Number.isInteger(sample.dy));
  const rates: number[] = [];
  const steps: number[] = [];
  let rounding = 0;
  /** Whether two events side by side, neither merged, show the decay clearer than rounding blurs it. */
  let readable = false;
  for (let i = 1; i < plain.length; i++) {
    const previous = plain[i - 1]!;
    const next = plain[i]!;
    const interval = next.t - previous.t;
    const across = run.some((sample) => sample.t > previous.t && sample.t < next.t);
    if (interval <= 0 || (interval > COAST_MAX_INTERVAL && !across) || !sameWay(previous, next)) {
      return null;
    }
    if (!across) steps.push(interval);
    const ratio = speed(next) / speed(previous);
    if (!(ratio > 0 && ratio <= 1)) return null;
    const perFrame = FRAME / interval;
    rates.push(ratio ** perFrame);
    // How far rounding each delta to a whole pixel can move this rate.
    const error = whole
      ? (WHOLE_PIXEL / speed(previous) + WHOLE_PIXEL / speed(next)) * perFrame
      : 0;
    rounding = Math.max(rounding, error);
    if (!across && ratio < 1 && error <= COAST_EVENNESS) readable = true;
  }
  // Read across a merged event, a slow, steady finger looks like a coast:
  // the coast must show its decay in events the page heard one by one too.
  if (plain.length < run.length && !readable) return null;
  const fastest = Math.min(...rates);
  const slowest = Math.max(...rates);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const steady =
    mean >= COAST_DECAY_MIN &&
    mean <= COAST_DECAY_MAX &&
    slowest < 1 + rounding &&
    slowest - fastest <= COAST_EVENNESS + rounding;
  if (!steady) return null;
  if (steps.length === 0) return null;
  const cadence = steps.reduce((sum, step) => sum + step, 0) / steps.length;
  for (let i = 1; i < run.length; i++) {
    const previous = run[i - 1]!;
    const next = run[i]!;
    if (!mergedAfter(previous, next)) continue;
    if (i > 1 && mergedAfter(run[i - 2]!, previous)) return null;
    const events = Math.round((next.t - previous.t) / cadence);
    const due = coastDistance({ step: speed(previous), cadence, rate: mean }, events);
    if (Math.abs(speed(next) - due) > due * MERGED_SPREAD + COAST_SLACK) return null;
  }
  return mean;
}

/**
 * A coast under way: the distance (px) it moves per event at its last
 * event, how often its events come (ms), and the share of its speed it
 * keeps per frame. Timestamps jitter by a few milliseconds while the
 * system steps a coast a frame at a time, so a coast is followed in events,
 * not milliseconds.
 */
interface Coast {
  readonly step: number;
  readonly cadence: number;
  readonly rate: number;
}

/** How far (px) `coast` moves over its next `events` events, keeping `rate` of its speed per frame. */
function coastDistance(coast: Coast, events: number, rate = coast.rate): number {
  const keep = Math.min(rate, 1) ** (coast.cadence / FRAME);
  let distance = 0;
  let step = coast.step;
  for (let i = 0; i < events; i++) {
    step *= keep;
    distance += step;
  }
  return distance;
}

/** The coast `run` (the fingers' last event, then the coast's) shows, decaying at `rate`. */
function coastOf(run: readonly WheelSample[], rate: number): Coast {
  const gaps = run
    .slice(1)
    .map((sample, i) => (mergedAfter(run[i]!, sample) ? null : sample.t - run[i]!.t))
    .filter((gap) => gap !== null);
  const cadence = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const keep = rate ** (cadence / FRAME);
  // The step at the last event that, decaying back to the first coast
  // event over all the steps the run carried, covers its distance.
  const steps = Math.max(run.length - 1, Math.round((run.at(-1)!.t - run[0]!.t) / cadence));
  let weights = 0;
  for (let i = 0; i < steps; i++) weights += keep ** -i;
  const travelled = run.slice(1).reduce((sum, sample) => sum + speed(sample), 0);
  return { step: travelled / weights, cadence, rate };
}

/**
 * `coast` carried on to `next`, its last event being `previous`; null when
 * `next` is something new: fingers touching down. A coast goes on the same
 * way until it stops, covering about the distance its physics gives over
 * the events due in the time, however many of them the browser merged into
 * one. A pause doesn't tell: the browser can hold events back without the
 * page knowing, and hand them over merged, stamped as late as the last of
 * them. Fingers do otherwise: they start slower than a coast still running,
 * and speed up past it. The coast is followed as it goes, so a rate read
 * slightly off at its start doesn't add up.
 */
function carryOn(coast: Coast, previous: WheelSample, next: WheelSample): Coast | null {
  if (!sameWay(previous, next)) return null;
  const events = Math.max(1, Math.round((next.t - previous.t) / coast.cadence));
  if (coast.step * (coast.rate ** (coast.cadence / FRAME)) ** events < COAST_STOPPED) return null;
  const moved = speed(next);
  const slowest = Math.min(1, coast.rate + COAST_DRIFT_UP);
  const quickest = Math.max(COAST_DECAY_MIN, coast.rate - COAST_DRIFT_DOWN);
  const most = coastDistance(coast, events, slowest) * COAST_MOST + COAST_SLACK;
  const least = coastDistance(coast, events, quickest) * COAST_LEAST - COAST_SLACK;
  if (moved > most || moved < least) return null;
  const expected = coastDistance(coast, events);
  const step = coast.step * (coast.rate ** (coast.cadence / FRAME)) ** events;
  const off = Math.min(Math.max((moved + WHOLE_PIXEL) / (expected + WHOLE_PIXEL), 0.5), 2);
  return { ...coast, step: step * Math.sqrt(off) };
}

/**
 * Whether `run`'s first event, where its decay starts, was the coast's own
 * first event rather than the fingers' last. The system can step a coast
 * at a slower pace than the trackpad reports fingers (a 60 Hz display, a
 * 120 Hz trackpad): then the coast's first event comes after a gap as long
 * as the coast's, where the fingers' events, `before` it, came closer.
 */
function beganCoast(
  before: readonly WheelSample[],
  run: readonly WheelSample[],
  coast: Coast,
): boolean {
  const [earlier, last] = before;
  if (earlier === undefined || last === undefined) return false;
  const fingersGap = last.t - earlier.t;
  const gap = run[0]!.t - last.t;
  return (
    gap >= CADENCE_CHANGE * fingersGap && gap >= 0.75 * coast.cadence && gap <= 1.6 * coast.cadence
  );
}

/**
 * The coast `run` ends in, if its last two events are the coast's first
 * and the rest of what came of it while the browser held events back. The
 * browser merges what it held one kind at a time: the fingers' moves into
 * one event, the coast's first event alone, the rest of the coast into one.
 * So an event that carries several steps, after one that came alone though
 * the browser held it back, or after the fingers' merged moves in the same
 * backlog, is the coast's, and so is the one before it. A touch's first
 * event comes alone too, but small, and the fingers then speed up: the
 * decay read from the two must be a coast's.
 */
function backlogCoast(
  run: readonly WheelSample[],
): { coast: Coast; coasted: WheelSample[] } | null {
  const last = run.length - 1;
  const merged = run[last];
  const start = run[last - 1];
  if (merged === undefined || start === undefined) return null;
  if (!carriesSteps(start, merged) || !sameWay(start, merged)) return null;
  // Held back while the page drew on, the fingers' moves since would have merged into it.
  const alone =
    heldBack(start) &&
    start.heard === undefined &&
    speed(start) > TOUCH_START &&
    merged.t <= start.got! + FRAME;
  const fingers = run[last - 2];
  const merging =
    fingers !== undefined &&
    (heldBack(fingers) || (last >= 3 && carriesSteps(run[last - 3]!, fingers)));
  const after =
    merging &&
    fingers.got !== undefined &&
    sameWay(fingers, start) &&
    merged.t <= fingers.got + FRAME;
  if (!alone && !after) return null;
  const events = Math.max(1, Math.round((merged.t - start.t) / FRAME));
  const coast = (rate: number): Coast => ({ step: speed(start), cadence: FRAME, rate });
  const moved = speed(merged);
  if (
    moved < coastDistance(coast(COAST_DECAY_MIN), events) ||
    moved > coastDistance(coast(COAST_DECAY_MAX), events)
  ) {
    return null;
  }
  let [low, high] = [COAST_DECAY_MIN, COAST_DECAY_MAX];
  for (let i = 0; i < 24; i++) {
    const rate = (low + high) / 2;
    if (coastDistance(coast(rate), events) < moved) low = rate;
    else high = rate;
  }
  const rate = (low + high) / 2;
  return { coast: { ...coast(rate), step: speed(start) * rate ** events }, coasted: [start] };
}

/**
 * Whether `next`, after a silence, is the gesture of `run` going on,
 * merged: too far for a touch's first event, the same way, at about the
 * pace before it over the gap. The browser held them back, and stamped
 * them as late as the last of them.
 */
function mergedMoves(run: readonly WheelSample[], next: WheelSample): boolean {
  const last = run.at(-1);
  const before = run.at(-2);
  if (last === undefined || before === undefined || last.t <= before.t) return false;
  const pace = speed(last) / (last.t - before.t);
  const moved = speed(next);
  return (
    moved > TOUCH_START && sameWay(last, next) && moved >= PACE_SHARE * pace * (next.t - last.t)
  );
}

/**
 * Finger contact read from wheel events alone. A gesture begins with the
 * first event after a silence (or one that breaks a coast), and the fingers
 * lift at the first of: a silence of `LIFT_GAP`, or a run of events that
 * decays like a coast. Silences count only while the page could hear
 * (`WheelSample.heard`, `.got`): a backlog is no lift and no new touch.
 */
export class WheelContact implements ContactSource {
  #last: WheelSample | null = null;
  /** Set while the fingers are down: their latest events, enough to recognise a coast's start. */
  #run: WheelSample[] | null = null;
  /** Set once the fingers lifted into a coast, until it ends. */
  #coast: Coast | null = null;
  /** The fingers' two events before the run, once it has moved past them. */
  #before: WheelSample[] = [];
  /** The run's silence was told a lift (`idle`), until its next event says whether it was. */
  #silent = false;

  wheel(sample: WheelSample): Contact {
    const last = this.#last;
    this.#last = sample;
    if (last !== null && this.#coast !== null) {
      const coast = carryOn(this.#coast, last, sample);
      if (coast !== null) {
        this.#coast = coast;
        return { phase: "coasting" };
      }
    }
    const silent = this.#silent;
    this.#silent = false;
    const run = this.#run;
    if (last !== null && this.#coast === null && run !== null) {
      // After a silence told a lift, the browser had held these back: the
      // gesture went on. One that carries what the silence hid says so by
      // its distance; the page didn't hear past the event before it.
      if (heardSilence(last, sample) <= LIFT_GAP) return this.#moved(run, sample, silent);
      if (mergedMoves(run, sample)) {
        const unheard = { ...sample, heard: Math.min(sample.heard ?? last.t, last.t) };
        this.#last = unheard;
        return this.#moved(run, unheard, silent);
      }
    }
    this.#run = [sample];
    this.#coast = null;
    this.#before = [];
    return { phase: "began" };
  }

  #moved(run: WheelSample[], sample: WheelSample, resumed: boolean): Contact {
    run.push(sample);
    if (run.length > COAST_RUN) this.#before = [...this.#before, run.shift()!].slice(-2);
    const read = this.#readCoast(run);
    if (read === null) return { phase: "moved", resumed };
    // The run's first event was the fingers' last (or, at a slower pace,
    // the coast's first); those after it, up to this one, were the coast
    // already.
    const { coast, coasted } = read;
    this.#coast = coast;
    this.#run = null;
    return {
      phase: "lifted",
      coasted: {
        dx: coasted.reduce((sum, s) => sum + s.dx, 0),
        dy: coasted.reduce((sum, s) => sum + s.dy, 0),
      },
    };
  }

  /**
   * The coast the fingers' latest events show, if they show one, and those
   * of them that were its. A backlog shows it at once (`backlogCoast`). A
   * run with an event the page was too busy to hear carries more of the
   * coast's steps than events, so its last four are enough: the coast can
   * then be recognised before fingers touch again.
   */
  #readCoast(run: readonly WheelSample[]): { coast: Coast; coasted: WheelSample[] } | null {
    const backlog = backlogCoast(run);
    if (backlog !== null) return backlog;
    const busy = run.some((sample, i) => i > 0 && mergedAfter(run[i - 1]!, sample));
    const tries: [readonly WheelSample[], readonly WheelSample[]][] = [];
    if (run.length === COAST_RUN) tries.push([run, this.#before]);
    if (busy && run.length >= COAST_RUN - 1) {
      const shorter = run.slice(-(COAST_RUN - 1));
      tries.push([
        shorter,
        [...this.#before, ...run.slice(0, run.length - shorter.length)].slice(-2),
      ]);
    }
    for (const [candidate, before] of tries) {
      const rate = coastRate(candidate);
      if (rate === null) continue;
      const coast = coastOf(candidate, rate);
      return { coast, coasted: candidate.slice(beganCoast(before, candidate, coast) ? 0 : 1, -1) };
    }
    return null;
  }

  idle(now: number): boolean {
    if (
      this.#run === null ||
      this.#silent ||
      this.#last === null ||
      now - this.#last.t <= LIFT_GAP
    ) {
      return false;
    }
    // The next event says by its own time whether the gesture went on: the
    // browser can hold events back without the page knowing.
    this.#silent = true;
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
