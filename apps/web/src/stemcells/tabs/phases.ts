import { WheelContact, type Contact, type ContactSource, type WheelSample } from "./swipe";

/**
 * A two-finger swipe read with macOS's own phases where the desktop app has them
 * (`stemcells/native/scroll-phases.m`, via `window.stemcellsScrollPhases` on the page's clock):
 * the strip lets go as the fingers lift, never following the coast. Wheel events still carry the
 * moves, placed by their time. With no phases, `WheelContact` reads the gesture from wheel alone.
 */

/** One scroll event's phases, as the system reported them. */
export interface ScrollPhases {
  /** When it happened (ms), on the page's clock: the time of its wheel event, if it has one. */
  readonly t: number;
  /** The fingers' `NSEventPhase`; 0 in the coast. */
  readonly phase: number;
  /** The coast's `NSEventPhase`; 0 while the fingers are down. */
  readonly momentum: number;
  /** Whether it moved; only then does the page get a wheel event for it. */
  readonly moved: boolean;
}

declare global {
  interface Window {
    /** The desktop app's scroll phases (`apps/desktop/src/stemcells/scrollPhasesPreload.ts`). */
    readonly stemcellsScrollPhases?: {
      subscribe(listener: (scroll: ScrollPhases) => void): () => void;
    };
  }
}

/** `NSEventPhase` values. */
const MAY_BEGIN = 32;
const BEGAN = 1;
const ENDED = 8;
const CANCELLED = 16;

/** How far apart (ms) a wheel event's time and its scroll event's may be: the page lines the two clocks up to within this. */
const SAME_TIME = 2;
/** How long (ms) phases are kept, to place a wheel event the browser held back. */
const KEEP = 2000;
/**
 * How far (ms) a wheel event may run ahead of the latest phases and still
 * be read by them: the phases reach the page about as soon as the wheel
 * event does, or sooner.
 */
const AHEAD = 250;

/** One touch of the fingers, as the system tells it. */
interface Touch {
  readonly began: number;
  /** The fingers' last move so far. */
  lastMove: number | null;
  lifted: number | null;
  /** Whether the coast after the lift is still running. */
  coasting: boolean;
}

/** The fingers lifted: what the hand took as their moves that were the coast's (px, wheel sense). */
interface Lift {
  readonly coasted: { readonly dx: number; readonly dy: number };
}

export class PhasedContact implements ContactSource {
  readonly #wheels = new WheelContact();
  #scrolls: ScrollPhases[] = [];
  /** The latest touch. */
  #touch: Touch | null = null;
  /** The touch the hand holds the strip by, and the wheel events taken as its moves. */
  #held: Touch | null = null;
  #moves: { readonly t: number; readonly dx: number; readonly dy: number }[] = [];
  /** The held touch has lifted, but its last move hasn't reached the page yet. */
  #liftDue = false;

  /** A scroll event's phases. Returns a `Lift` when they say the held fingers lifted, now. */
  scroll(scroll: ScrollPhases): Lift | null {
    this.#scrolls.push(scroll);
    while (this.#scrolls[0]!.t < scroll.t - KEEP) this.#scrolls.shift();
    let touch = this.#touch;
    if ((scroll.phase === MAY_BEGIN || scroll.phase === BEGAN) && touch?.lifted !== null) {
      touch = { began: scroll.t, lastMove: null, lifted: null, coasting: false };
      this.#touch = touch;
    }
    if (touch === null) return null;
    if (touch.lifted !== null) {
      if (scroll.momentum !== 0) touch.coasting = scroll.momentum !== ENDED;
      return null;
    }
    if (scroll.phase !== 0 && scroll.moved) touch.lastMove = scroll.t;
    if (scroll.phase !== ENDED && scroll.phase !== CANCELLED) return null;
    touch.lifted = scroll.t;
    return touch === this.#held ? this.#letGo(false) : null;
  }

  wheel(sample: WheelSample): Contact {
    // Always, so it knows the gesture should the phases stop.
    const alone = this.#wheels.wheel(sample);
    const kind = this.#kind(sample.t);
    if (kind === null) return alone;
    if (kind === "coast") {
      if (!this.#liftDue) return { phase: "coasting" };
      return { phase: "lifted", coasted: this.#letGo(true)!.coasted };
    }
    // The latest touch's move, or a late one of the touch before it.
    const latest = this.#touch;
    const touch = latest !== null && sample.t >= latest.began - SAME_TIME ? latest : this.#held;
    if (touch === null) return latest === null ? alone : { phase: "coasting" };
    const first = touch !== this.#held;
    if (first) {
      this.#held = touch;
      this.#moves = [];
      this.#liftDue = false;
    }
    this.#moves.push({ t: sample.t, dx: sample.dx, dy: sample.dy });
    const lifts = touch.lifted !== null && sample.t >= (touch.lastMove ?? -Infinity) - SAME_TIME;
    if (lifts) this.#letGo(true);
    return first ? { phase: "began", lifts } : { phase: "moved", lifts };
  }

  idle(now: number): boolean {
    // The phases say when the fingers lift; a silence in a touch they tell of says nothing.
    if (this.#held !== null) return false;
    return this.#wheels.idle(now);
  }

  /**
   * Whose move the wheel event at `t` was: the fingers', the coast's, or
   * neither as far as the phases tell (a mouse wheel's; null).
   */
  #kind(t: number): "fingers" | "coast" | null {
    const scroll = this.#scrollAt(t);
    if (scroll !== null) {
      if (scroll.phase !== 0) return "fingers";
      return scroll.momentum !== 0 ? "coast" : null;
    }
    // Ahead of the phases: the latest touch going on, or the coast after it.
    const touch = this.#touch;
    const latest = this.#scrolls.at(-1)?.t;
    if (touch === null || latest === undefined || t <= latest + SAME_TIME || t > latest + AHEAD) {
      return null;
    }
    if (touch.lifted === null) return "fingers";
    return touch.coasting || t - touch.lifted <= AHEAD ? "coast" : null;
  }

  /** The scroll event at `t`, if the page has it. */
  #scrollAt(t: number): ScrollPhases | null {
    for (let i = this.#scrolls.length - 1; i >= 0; i--) {
      const scroll = this.#scrolls[i]!;
      if (Math.abs(scroll.t - t) <= SAME_TIME) return scroll;
      if (scroll.t < t - SAME_TIME) break;
    }
    return null;
  }

  /**
   * The held touch lifted: it lets go now, unless its last move is still to
   * reach the page (`force`: no longer). Moves taken after its last were
   * the coast's.
   */
  #letGo(force: boolean): Lift | null {
    const last = this.#held?.lastMove ?? -Infinity;
    if (!force && (this.#moves.at(-1)?.t ?? -Infinity) < last - SAME_TIME) {
      this.#liftDue = true;
      return null;
    }
    const coasted = this.#moves.filter((move) => move.t > last + SAME_TIME);
    this.#held = null;
    this.#moves = [];
    this.#liftDue = false;
    return {
      coasted: {
        dx: coasted.reduce((sum, move) => sum + move.dx, 0),
        dy: coasted.reduce((sum, move) => sum + move.dy, 0),
      },
    };
  }
}
