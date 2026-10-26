import { dragBy, dragPosition, releaseTarget, startDrag, type Drag } from "./pager";
import { SwipeLatch, WheelContact, type ContactSource, type WheelSample } from "./swipe";

/**
 * The fingers on the page strip, one wheel event at a time: which gesture an event belongs to
 * (`ContactSource`), whose that gesture is (`SwipeLatch`), where the strip follows, and the page
 * it goes to on lift. It moves nothing itself; the strip it holds does, so the same hand runs in
 * the app and in a replay of a recorded swipe.
 */
export interface HeldStrip {
  /** Where the strip is on screen (pages), a slide included. */
  at(): number;
  /** Whether it is still sliding from a turn or a swipe: a hand on it now catches it. */
  sliding(): boolean;
  /** The page it is on or on its way to; null with no pages. */
  heading(): number | null;
  /** How many pages it has. */
  count(): number;
  /** How wide a page is (px). */
  width(): number;
  /** The fingers take the strip where it is on screen: a slide stops there. */
  grab(at: number): void;
  /** The fingers moved it to `position`. */
  hold(position: number): void;
  /** The fingers let go: it springs from `from` to page `to`, setting off at `pagesPerSecond`. */
  release(from: number, to: number, pagesPerSecond: number): void;
}

/** How far back (ms) the strip's moves count toward its speed when the fingers lift. */
const SPEED_WINDOW = 60;

export class SwipeHand {
  readonly #strip: HeldStrip;
  readonly #source: ContactSource;
  #latch: SwipeLatch | null = null;
  #drag: Drag | null = null;
  /** The drag a silence let go, until the gesture's next event says whether the fingers lifted. */
  #letGoOf: Drag | null = null;
  #position = 0;
  /** The strip's recent positions while held, for its speed when let go. */
  #trail: { readonly t: number; readonly position: number }[] = [];

  constructor(strip: HeldStrip, source: ContactSource = new WheelContact()) {
    this.#strip = strip;
    this.#source = source;
  }

  /**
   * A wheel event over the strip. `scrollerTakes(direction)`: whether
   * something under the fingers scrolls that way and has room to. True when
   * the page must leave the event alone (the pager has, or may yet have,
   * this gesture).
   */
  wheel(sample: WheelSample, scrollerTakes: (direction: 1 | -1) => boolean): boolean {
    const contact = this.#source.wheel(sample);
    if (contact.phase === "began") {
      this.#letGo(0, sample.t);
      this.#letGoOf = null;
      this.#latch = new SwipeLatch(scrollerTakes, { catching: this.#strip.sliding() });
      this.#trail = [];
    }
    if (contact.phase === "moved" && contact.resumed === true && this.#letGoOf !== null) {
      this.#resume(this.#letGoOf);
    }
    if (contact.phase === "began" || contact.phase === "moved") {
      this.#move(sample);
      if (contact.lifts === true) this.#letGo(0, sample.t);
    }
    if (contact.phase === "lifted") this.#letGo(contact.coasted.dx, sample.t);
    if (contact.phase !== "coasting") this.#letGoOf = null;
    return this.#latch?.holds === true;
  }

  /** Whether the fingers hold the strip now. */
  get holding(): boolean {
    return this.#drag !== null;
  }

  /** No wheel event since the last, up to `now`: lets go if that silence means the fingers lifted. */
  idle(now: number): void {
    if (!this.#source.idle(now)) return;
    const drag = this.#drag;
    this.#letGo(0, now);
    this.#letGoOf = drag;
  }

  /**
   * The fingers lifted at `at`, as the system said (`PhasedContact`):
   * the strip springs to the page the move earned. `coasted`: px of what
   * the hand took as their moves that was the coast's.
   */
  lift(coasted: number, at: number): void {
    this.#letGo(coasted, at);
    this.#letGoOf = null;
  }

  /** The tabs turned by other means while the fingers were down: the rest of this gesture goes nowhere. */
  spend(): void {
    this.#latch?.spend();
    this.#drag = null;
    this.#letGoOf = null;
  }

  /** The pages moved under the fingers: they take the strip again where it now is. */
  regrab(): void {
    this.#grab();
  }

  #move(sample: WheelSample): void {
    const latch = this.#latch;
    if (latch === null) return;
    const held = latch.owner === "pager";
    const dx = latch.move(sample.dx, sample.dy);
    if (latch.owner !== "pager") return;
    if (!held || this.#drag === null) this.#grab();
    const drag = dragBy(this.#drag!, dx);
    this.#drag = drag;
    this.#position = dragPosition(drag);
    this.#trail.push({ t: sample.t, position: this.#position });
    while (this.#trail.length > 2 && this.#trail[0]!.t < sample.t - SPEED_WINDOW) {
      this.#trail.shift();
    }
    this.#strip.hold(this.#position);
  }

  /** The fingers take the strip where it is on screen: latest input wins. */
  #grab(): void {
    const strip = this.#strip;
    const at = strip.at();
    strip.grab(at);
    this.#position = at;
    const heading = strip.heading();
    this.#drag = startDrag(at, heading ?? Math.round(at), strip.count(), strip.width());
  }

  /**
   * The fingers never lifted from `drag` after all: they take the strip
   * again where it is on screen, the swipe going on from the move it had.
   */
  #resume(drag: Drag): void {
    const strip = this.#strip;
    const at = strip.at();
    strip.grab(at);
    this.#position = at;
    const again = startDrag(at, drag.heading, strip.count(), strip.width());
    this.#drag = { ...again, from: again.from - drag.travel / again.width, travel: drag.travel };
  }

  /** The strip's speed (pages per second) as the fingers left it, by `now`. */
  #speed(now: number): number {
    const first = this.#trail[0];
    const last = this.#trail.at(-1);
    if (!first || !last || last.t <= first.t || now - last.t > SPEED_WINDOW) return 0;
    return ((last.position - first.position) / (last.t - first.t)) * 1000;
  }

  /** The fingers lifted, `coasted` px into the coast: the strip springs to the page the move earned. */
  #letGo(coasted: number, now: number): void {
    const drag = this.#drag;
    if (drag === null) return;
    this.#drag = null;
    const target = releaseTarget(drag, drag.travel - coasted);
    this.#strip.release(this.#position, target, this.#speed(now));
  }
}
