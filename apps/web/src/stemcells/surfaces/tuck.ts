/** How far a press may wander and still be a click, in pixels. */
const CLICK_SLOP = 4;

/** How far the tucked tab is pushed into the chat's edge before letting go puts it away. */
export const PUT_AWAY_PAST = 24;

/** What letting go of the tucked tab does. */
export type TuckRelease = "open" | "put-away" | "spring-back" | "none";

/**
 * One press on the tucked tab, from pointer down to up. A press that never wanders is a click
 * and opens; one that wandered is a drag and never opens: pushed far enough into the edge it
 * puts the tab away, else it springs back. A press that opened the tab's menu (held on touch,
 * or ctrl-clicked) does nothing more on release.
 */
export class TuckPress {
  readonly #x: number;
  readonly #y: number;
  #wandered = false;
  #held = false;
  #pull = 0;

  constructor(x: number, y: number) {
    this.#x = x;
    this.#y = y;
  }

  /** Follows the pointer; the tab's pull toward the edge, or null while it is still a click. */
  move(x: number, y: number): number | null {
    if (this.#held) return null;
    const dx = x - this.#x;
    if (!this.#wandered && Math.hypot(dx, y - this.#y) <= CLICK_SLOP) return null;
    this.#wandered = true;
    this.#pull = Math.max(0, dx);
    return this.#pull;
  }

  /** The press opens the tab's menu instead, once; never a drag's. Whether it may. */
  hold(): boolean {
    if (this.#wandered || this.#held) return false;
    this.#held = true;
    return true;
  }

  get wandered(): boolean {
    return this.#wandered;
  }

  release(): TuckRelease {
    if (this.#held) return "none";
    if (!this.#wandered) return "open";
    return this.#pull >= PUT_AWAY_PAST ? "put-away" : "spring-back";
  }
}
