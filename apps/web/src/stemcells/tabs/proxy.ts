import { BEGAN, CANCELLED, ENDED, MAY_BEGIN, type ScrollPhases } from "./phases";

/**
 * The pager's proxy: a swipe is a native scroll of a sideways scroller with a snap slot each
 * viewport width, which the pages follow by a scroll-linked animation, so fingers, coast and snap
 * run on the compositor, busy page or not. Its keyframes are the knots; here are they and the
 * rules that move them (`pageStrip.ts` puts them on the page).
 */

/** The slots on the proxy's track, and the one it rests on: room for twenty turns either way before it rests. */
export const SLOTS = 41;
export const REST_SLOT = 20;

/** How far (pages) the strip gives past its first or last page: a quarter of the fingers' move, up to half a page of it. */
export const END_GIVE = 0.125;

/** With the proxy on `slot`, the pages stand `offset` pages on from the strip's own place. */
export interface Knot {
  readonly slot: number;
  readonly offset: number;
}

/** What lies a page to one side of where a touch began: a page, the strip's end, or nothing more for this touch. */
export type Side = "page" | "end" | "wall";

/**
 * The knots about `origin`: a page either side follows the proxy one to one, an end gives and
 * comes back, and past a slot either way nothing moves, however far the proxy goes.
 */
export function walls(origin: number, back: Side, on: Side): Knot[] {
  const knots: Knot[] = [];
  if (back === "page") knots.push({ slot: origin - 1, offset: -1 });
  if (back === "end") {
    knots.push({ slot: origin - 1, offset: 0 }, { slot: origin - 0.5, offset: -END_GIVE });
  }
  knots.push({ slot: origin, offset: 0 });
  if (on === "page") knots.push({ slot: origin + 1, offset: 1 });
  if (on === "end") {
    knots.push({ slot: origin + 0.5, offset: END_GIVE }, { slot: origin + 1, offset: 0 });
  }
  return knots;
}

/** The pages' offset with the proxy on `slot`: straight lines between the knots, level past the outer ones. */
export function offsetAt(knots: readonly Knot[], slot: number): number {
  const first = knots[0];
  if (first === undefined) return 0;
  if (slot <= first.slot) return first.offset;
  for (let i = 1; i < knots.length; i++) {
    const from = knots[i - 1]!;
    const to = knots[i]!;
    if (slot > to.slot) continue;
    return from.offset + ((to.offset - from.offset) * (slot - from.slot)) / (to.slot - from.slot);
  }
  return knots.at(-1)!.offset;
}

/** The knots as keyframes along a track of `slots`: `at` runs 0 to 1 from its first slot to its last. */
export function keyed(
  knots: readonly Knot[],
  slots = SLOTS,
): { readonly at: number; readonly offset: number }[] {
  const last = slots - 1;
  const inside = knots.filter((knot) => knot.slot > 0 && knot.slot < last);
  return [
    { slot: 0, offset: offsetAt(knots, 0) },
    ...inside,
    { slot: last, offset: offsetAt(knots, last) },
  ].map((knot) => ({ at: knot.slot / last, offset: knot.offset }));
}

/** How far apart (ms) a wheel event's time and its scroll event's may be (`scrollPhasesPreload.ts` lines the clocks up). */
const SAME_TIME = 2;
/** How many wheel events are kept to tell whose a touch was. */
const KEPT_WHEELS = 32;

/** One touch of the fingers, as the system tells it. */
interface Touch {
  readonly began: number;
  down: boolean;
  /** Whether the fingers have moved: until then they only rest on the trackpad. */
  moved: boolean;
  /** The way it was flicked: the way its coast set off, sideways. */
  flick: -1 | 0 | 1;
  /** Whether its coast has set off, so `flick` is known. */
  coasted: boolean;
  /** Whether it has been given the page a flick is owed. */
  paid: boolean;
}

/**
 * What a swipe may do to the strip. One touch shows at most one page further: the knots are level
 * past a page either side of where the strip was headed when it began, and move only when the
 * system says a new touch begins or the proxy rests. A flick ends one page on: where the
 * browser's snap leaves it short, the strip is owed that page (`pay`).
 */
export class Turns {
  #count = 1;
  #place = 0;
  #origin = REST_SLOT;
  /** The slot the proxy is going to, as the browser last said. */
  #target = REST_SLOT;
  /** Where the proxy was last seen. */
  #at = REST_SLOT;
  #resting = true;
  /** The strip went elsewhere by other means: what the proxy does until a new touch or its rest shows nothing. */
  #spent = false;
  /** The side this touch gets nothing more from. */
  #wall: -1 | 0 | 1 = 0;
  #touch: Touch | null = null;
  /** The latest wheel events over the proxy: when, and whether it was the proxy's to scroll. */
  #wheels: { readonly t: number; readonly ours: boolean }[] = [];

  /** The page the strip's own place is on, or sliding to. */
  get place(): number {
    return this.#place;
  }

  /** The slot that place shows on. */
  get origin(): number {
    return this.#origin;
  }

  /** Whether the proxy is at rest on its origin. */
  get resting(): boolean {
    return this.#resting;
  }

  get knots(): Knot[] {
    if (this.#spent) return [{ slot: this.#origin, offset: 0 }];
    return walls(this.#origin, this.#side(-1), this.#side(1));
  }

  /** The page the strip is headed for: the one the proxy's target shows. */
  get heading(): number {
    return this.#page(this.#place + Math.round(offsetAt(this.knots, this.#target)));
  }

  /** Whether the proxy has reached its target, to the pixel, or rests. */
  landed(pixel: number): boolean {
    return this.#resting || Math.abs(this.#at - this.#target) <= pixel;
  }

  /** The strip's own place and its pages changed under the proxy. */
  set(place: number, count: number): void {
    this.#count = Math.max(count, 1);
    this.#place = this.#page(place);
  }

  /** The strip goes elsewhere by other means: fingers on the proxy give it up. */
  spend(): void {
    if (!this.#resting) this.#spent = true;
    this.#wall = 0;
  }

  /** A wheel event over the proxy at `t`: `ours` if the proxy is what it scrolls. */
  wheel(t: number, ours: boolean): void {
    this.#wheels.push({ t, ours });
    if (this.#wheels.length > KEPT_WHEELS) this.#wheels.shift();
  }

  /** A scroll event's phases, where the desktop app sends them. */
  phases(scroll: ScrollPhases): void {
    if (scroll.phase === MAY_BEGIN || scroll.phase === BEGAN) {
      // Fingers resting, then moving, are one touch. Any other beginning is a new one, even
      // with the last still down as far as the page heard: its lift got lost.
      const resting = this.#touch !== null && this.#touch.down && !this.#touch.moved;
      if (!resting) this.#touched(scroll.t);
      if (scroll.phase === BEGAN && this.#touch !== null) this.#touch.moved = true;
      return;
    }
    const touch = this.#touch;
    if (touch === null) return;
    if (scroll.phase === ENDED || scroll.phase === CANCELLED) touch.down = false;
    if (scroll.momentum !== 0 && scroll.moved && !touch.down && !touch.coasted) {
      touch.coasted = true;
      const sideways = Math.abs(scroll.dx) > Math.abs(scroll.dy);
      touch.flick = !sideways ? 0 : scroll.dx > 0 ? 1 : -1;
    }
  }

  /** The browser's word on the slot the proxy will snap to. */
  aimed(slot: number): void {
    this.#target = slot;
  }

  /** Whether a lifted touch was flicked and its page is still to be settled (`pay`). */
  get owing(): boolean {
    const touch = this.#touch;
    return touch !== null && !touch.down && !touch.paid && touch.flick !== 0;
  }

  /**
   * Settles a flicked touch's page: where the browser's snap leaves the strip short of the next
   * page in the flick's way, the strip's own place moves on one, and that side is walled, so the
   * touch has one page whatever the proxy then does. Call it once the page has heard where the
   * proxy is going since the lift: a frame or two after `owing` turns true.
   */
  pay(): void {
    const touch = this.#touch;
    if (touch === null || !this.owing) return;
    touch.paid = true;
    if (this.#spent || !this.#ours(touch)) return;
    if (Math.round(offsetAt(this.knots, this.#target)) !== 0) return;
    const page = this.#place + touch.flick;
    if (page < 0 || page >= this.#count) return;
    this.#wall = touch.flick;
    this.#place = page;
  }

  /** The proxy scrolled to `slot`; `pixel` is a pixel in slots. */
  scrolled(slot: number, pixel: number): void {
    this.#at = slot;
    if (Math.abs(slot - this.#origin) > pixel) this.#resting = false;
    // Landed with the fingers known to be up: the walls go round the page it landed on now, so
    // the next touch finds them there however long the page takes to hear of it.
    const touch = this.#touch;
    const up = touch !== null && !touch.down;
    if (up && this.#target !== this.#origin && Math.abs(slot - this.#target) <= pixel) {
      this.#rebase(this.#target);
    }
  }

  /** The proxy came to rest on `slot`. It goes back to `REST_SLOT`, which now shows the strip's place. */
  rested(slot: number): void {
    this.#rebase(slot);
    this.#origin = REST_SLOT;
    this.#target = REST_SLOT;
    this.#at = REST_SLOT;
    this.#resting = true;
    if (this.#touch !== null && !this.#touch.down) this.#touch = null;
  }

  #page(page: number): number {
    return Math.min(Math.max(page, 0), this.#count - 1);
  }

  #side(way: -1 | 1): Side {
    if (this.#wall === way) return "wall";
    const page = this.#place + way;
    return page >= 0 && page < this.#count ? "page" : "end";
  }

  #touched(began: number): void {
    this.#touch = { began, down: true, moved: false, flick: 0, coasted: false, paid: false };
    if (!this.#resting) this.#rebase(this.#target);
  }

  /** The strip's own place becomes the page `slot` shows, and the walls go round that slot. */
  #rebase(slot: number): void {
    this.#place = this.#page(this.#place + Math.round(offsetAt(this.knots, slot)));
    this.#origin = slot;
    this.#wall = 0;
    this.#spent = false;
  }

  /** Whether the proxy was the touch's to scroll: so its first wheel event says. */
  #ours(touch: Touch): boolean {
    return this.#wheels.find((wheel) => wheel.t >= touch.began - SAME_TIME)?.ours === true;
  }
}
