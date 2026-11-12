import type { RefObject } from "react";

import { reducedMotion, spring, timed } from "../tokens/motion.ts";
import { cssLinear, settledDuration, springAt } from "../tokens/spring.ts";
import { releaseVelocity } from "./pager";
import type { ScrollPhases } from "./phases";
import { observeResize } from "../upstream/ui";
import { keyed, offsetAt, SLOTS, Turns, type Knot } from "./proxy";

/** The new Cell's page, and what follows it (`TabPager`). */
export interface NewCellPage {
  readonly id: string | null;
  readonly tab: RefObject<HTMLElement | null>;
  readonly onMotion: (moving: boolean) => void;
}

export const NO_NEW_CELL: NewCellPage = {
  id: null,
  tab: { current: null },
  onMotion: () => undefined,
};

/** The strip at `position` (in pages): page `i` is on stage at `i`. */
const stripAt = (position: number): string => `translate3d(${-position * 100}%, 0, 0)`;
/** A page in its place on the strip. */
const pageAt = (slot: number): string => `translate3d(${slot * 100}%, 0, 0)`;
/** The strip's hold with the pages `offset` pages on from the strip's own place. */
const holdAt = (offset: number): string => `translate3d(${-offset * 100}%, 0, 0)`;

/**
 * Whether something under `target`, inside `boundary`, scrolls sideways in
 * `direction` and has room to: then the browser gives the gesture to it,
 * not to the proxy.
 */
function scrollerTakes(
  target: EventTarget | null,
  boundary: HTMLElement,
  direction: 1 | -1,
): boolean {
  for (
    let element = target instanceof Element ? target : null;
    element !== null && element !== boundary;
    element = element.parentElement
  ) {
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const overflow = getComputedStyle(element).overflowX;
    if (overflow !== "auto" && overflow !== "scroll") continue;
    const room =
      direction > 0
        ? element.scrollWidth - element.clientWidth - element.scrollLeft
        : element.scrollLeft;
    if (room > 1) return true;
  }
  return false;
}

/** Whether the browser says where a scroll will snap to, and when it has come to rest. */
const SAYS_AIM = typeof window !== "undefined" && "onscrollsnapchanging" in window;
const SAYS_REST = typeof window !== "undefined" && "onscrollend" in window;
/** Without `scrollend`: how long (ms) after its last scroll event the proxy counts as at rest. */
const REST_AFTER = 150;

/**
 * How far (px) the strip may stand from its place with no slide there: a slide nobody sees still
 * runs its whole spring, and the tab turns only once it has ended.
 */
const NO_SLIDE = 1.5;

const sameKnots = (a: readonly Knot[], b: readonly Knot[]): boolean =>
  a.length === b.length &&
  a.every((knot, i) => knot.slot === b[i]!.slot && knot.offset === b[i]!.offset);

/**
 * The strip: the pages on it and the swipe moving it; the tabs and the column's stages each have
 * one. A swipe scrolls the proxy (`proxy.ts`) and the hold round the strip follows on the
 * compositor. The strip in the hold slides by a spring: a click's turn, a page a flick is owed,
 * and any jump a change of knots would show. On screen is the two together.
 */
export class PageStrip {
  #scroller: HTMLElement | null = null;
  #hold: HTMLElement | null = null;
  #strip: HTMLElement | null = null;
  readonly #pages = new Map<string, HTMLElement>();
  #order: readonly string[] = [];
  #active: string | null = null;
  /** The strip's own place: the page it is on, or sliding to. */
  #position = 0;
  #slide: Animation | null = null;
  /** The running slide's spring: its ends (pages) and the speed it set off with (moves a second). */
  #slideSpring: { readonly from: number; readonly to: number; readonly velocity: number } | null =
    null;
  /** The new Cell's tab, sliding alongside. */
  #tabSlide: Animation | null = null;
  #newCell: NewCellPage = NO_NEW_CELL;
  /** Whether the pages were moving, as `data-moving` last said. */
  #moving = false;
  /**
   * A turn to a tab further than the next one: the page being left stands
   * in beside the page arriving, over the page that is really there, so the
   * slide is one page long instead of passing every page between.
   */
  #standIn: { readonly tab: string; readonly slot: number; readonly covers: string | null } | null =
    null;
  #turn: (tabId: string) => void = () => undefined;
  /** Hears the page the strip is headed for, as the fingers move it and as it lets go. */
  #aimed: (tabId: string) => void = () => undefined;
  #aim: string | null = null;

  readonly #turns = new Turns();
  /** The knots the hold follows the proxy by, as last written. */
  #knots: readonly Knot[] = [];
  #timeline: ScrollTimeline | null = null;
  /** The hold following the proxy, and the new Cell's tab following it too. */
  #follow: Animation | null = null;
  #tabFollow: Animation | null = null;
  /** Whether the fingers are what scrolls the proxy: since a wheel or a touch on it, until it rests. */
  #fingers = false;
  /** The turns asked for and not yet rendered. */
  #asked: string[] = [];
  /** A frame or two on, a flicked touch's page is settled (`Turns.pay`). */
  #paying = 0;
  /** A turn waits for the frame that puts the proxy back at rest. */
  #turning = 0;
  #restTimer: ReturnType<typeof setTimeout> | undefined;
  /** The new Cell's tab and the keys it follows the proxy by, as last linked. */
  #tabLinked: { readonly tab: HTMLElement; readonly keys: string } | null = null;
  #unresize: (() => void) | undefined;
  /** Stops the desktop app's scroll phases coming, where it sends them. */
  #unphase: (() => void) | undefined;

  /**
   * `scroller` is the proxy (`ProxyTrack` lays its track out), `hold` the box round the strip
   * that follows its scroll, `strip` the strip.
   */
  attach(scroller: HTMLElement, hold: HTMLElement, strip: HTMLElement): void {
    this.#scroller = scroller;
    this.#hold = hold;
    this.#strip = strip;
    strip.style.transform = stripAt(this.#position);
    this.#placeAll();
    this.#timeline =
      typeof ScrollTimeline === "function"
        ? new ScrollTimeline({ source: scroller, axis: "x" })
        : null;
    // Whatever the proxy was doing when last attached, it rests now.
    this.#turns.rested(this.#turns.origin, performance.now());
    this.#fingers = false;
    this.#toOrigin();
    this.#writeKnots(true);
    // All passive: nothing here may hold the proxy's scroll back.
    scroller.addEventListener("scroll", this.#onScroll, { passive: true });
    scroller.addEventListener("scrollend", this.#onRest);
    scroller.addEventListener("scrollsnapchanging", this.#onAim);
    scroller.addEventListener("wheel", this.#onWheel, { passive: true });
    scroller.addEventListener("touchstart", this.#onTouch, { passive: true });
    // A proxy laid out later, or at another width, is still on the slot it rests on.
    this.#unresize = observeResize(scroller, () => {
      if (this.#turns.resting) this.#toOrigin();
    });
    this.#unphase = window.stemcellsScrollPhases?.subscribe(this.#onPhases);
  }

  detach(): void {
    const scroller = this.#scroller;
    scroller?.removeEventListener("scroll", this.#onScroll);
    scroller?.removeEventListener("scrollend", this.#onRest);
    scroller?.removeEventListener("scrollsnapchanging", this.#onAim);
    scroller?.removeEventListener("wheel", this.#onWheel);
    scroller?.removeEventListener("touchstart", this.#onTouch);
    scroller?.removeAttribute("data-moving");
    this.#unresize?.();
    this.#unresize = undefined;
    this.#unphase?.();
    this.#unphase = undefined;
    this.#moving = false;
    this.#stopSlide();
    this.#follow?.cancel();
    this.#follow = null;
    this.#tabFollow?.cancel();
    this.#tabFollow = null;
    this.#timeline = null;
    cancelAnimationFrame(this.#paying);
    this.#paying = 0;
    cancelAnimationFrame(this.#turning);
    this.#turning = 0;
    clearTimeout(this.#restTimer);
    this.#tabLinked = null;
    this.#scroller = null;
    this.#hold = null;
    this.#strip = null;
  }

  setPage(tabId: string, node: HTMLElement | null): void {
    if (node === null) {
      this.#pages.delete(tabId);
      return;
    }
    this.#pages.set(tabId, node);
    this.#place(tabId, node);
  }

  /** After each render: the strip's tabs and the active one, as React has them now. */
  sync(
    order: readonly string[],
    active: string,
    turn: (tabId: string) => void,
    newCell: NewCellPage = NO_NEW_CELL,
  ): void {
    this.#turn = turn;
    this.#newCell = newCell;
    if (this.#active === null) {
      this.#order = order;
      this.#active = active;
      this.#aim = active;
      this.#placeAll();
      this.#show(this.#slotOf(active));
      return;
    }
    const reordered =
      order.length !== this.#order.length || order.some((id, i) => id !== this.#order[i]);
    const turned = active !== this.#active;
    // A render that moved nothing reads nothing: where a sliding strip is costs a style pass,
    // and this runs after every render of the workspace.
    if (!turned && !reordered) {
      this.#placeAll();
      this.#linkNewTab();
      return;
    }
    // Where the eye has the strip: the tab on stage, and how far off it.
    const at = this.#onScreen();
    const offset = this.#offset();
    const speed = this.#speed();
    const stage = this.#tabAt(Math.round(at));
    const offStage = stage === null ? 0 : at - this.#slotOf(stage);
    const base = this.#tabAt(this.#position);
    const heading = this.#tabAt(this.#turns.heading);
    this.#order = order;
    this.#active = active;
    if (reordered) this.#standIn = null;
    this.#placeAll();
    // A turn this strip asked for is its own, even one a later swipe has since gone past.
    const asked = this.#asked.indexOf(active);
    const own = turned && (active === heading || asked >= 0);
    if (turned) this.#asked = asked < 0 ? [] : this.#asked.slice(asked + 1);
    const stageSlot = stage === null ? -1 : this.#slotOf(stage);
    const here = stageSlot < 0 ? null : stageSlot + offStage;
    if (turned && !own) {
      // A turn by other means. Fingers on the proxy give it up: the strip slides from where the
      // eye has it, and what the proxy does until it rests shows nothing.
      this.#turns.spend();
      this.#writeKnots();
      this.#travelTo(active, here, stage, speed);
      return;
    }
    // A swipe's own turn landing, or tabs that moved under the strip: the
    // strip keeps the page on stage where the eye has it.
    const baseSlot = base === null ? -1 : this.#slotOf(base);
    if (here === null || baseSlot < 0) {
      this.#cut(this.#slotOf(active));
    } else if (baseSlot !== this.#position || Math.abs(here - at) > 1e-6) {
      this.#travel(here - offset, baseSlot, speed, true);
    } else {
      this.#turns.set(this.#position, this.#order.length);
      this.#writeKnots();
    }
    this.#decide();
  }

  /** Who hears where the strip is headed (`#aimed`); the page on stage once at rest. */
  aimed(listener: (tabId: string) => void): void {
    this.#aimed = listener;
  }

  #aimAt(slot: number): void {
    const tabId = this.#tabAt(Math.min(Math.max(slot, 0), this.#order.length - 1));
    if (tabId === null || tabId === this.#aim) return;
    this.#aim = tabId;
    this.#aimed(tabId);
  }

  #slotOf(tabId: string): number {
    if (this.#standIn?.tab === tabId) return this.#standIn.slot;
    return this.#order.indexOf(tabId);
  }

  #tabAt(slot: number): string | null {
    if (this.#standIn?.slot === slot) return this.#standIn.tab;
    const tabId = this.#order[slot] ?? null;
    return tabId === this.#standIn?.tab ? null : tabId;
  }

  #place(tabId: string, node: HTMLElement): void {
    const slot = this.#slotOf(tabId);
    node.style.transform = slot < 0 ? "" : pageAt(slot);
    node.style.visibility = this.#standIn?.covers === tabId ? "hidden" : "";
  }

  #placeAll(): void {
    for (const [tabId, node] of this.#pages) this.#place(tabId, node);
  }

  /** A slot's width on the proxy's track (px); 0 before it is laid out. */
  #slotWidth(): number {
    return (this.#scroller?.scrollWidth ?? 0) / SLOTS;
  }

  /** The slot the proxy is on, between two as it moves. At rest nothing is read off the page. */
  #slot(): number {
    return this.#turns.resting ? this.#turns.origin : this.#scrolledTo();
  }

  /** The slot the proxy has scrolled to, read off the page. */
  #scrolledTo(): number {
    const width = this.#slotWidth();
    const scroller = this.#scroller;
    return scroller === null || width === 0 ? this.#turns.origin : scroller.scrollLeft / width;
  }

  /** Puts the proxy on the slot the strip's place shows on, now. */
  #toOrigin(): void {
    this.#scroller?.scrollTo({ left: this.#turns.origin * this.#slotWidth(), behavior: "instant" });
  }

  /** How far (pages) the hold has the pages from the strip's own place, as the page knows the proxy. */
  #offset(): number {
    return offsetAt(this.#knots, this.#slot());
  }

  /** The strip's own place now, a slide included. */
  #own(): number {
    const strip = this.#strip;
    if (this.#slide === null || strip === null) return this.#position;
    const width = strip.clientWidth;
    const transform = getComputedStyle(strip).transform;
    if (width === 0 || transform === "none") return this.#position;
    return -new DOMMatrixReadOnly(transform).m41 / width;
  }

  /** Where the strip is on screen: its own place and the hold's offset together. */
  #onScreen(): number {
    return this.#own() + this.#offset();
  }

  /** How fast the strip itself moves now, in pages a second toward later pages: a slide's speed, or none. */
  #speed(): number {
    const spec = this.#slideSpring;
    const elapsed = this.#slide?.currentTime;
    if (spec === null || typeof elapsed !== "number") return 0;
    const page = spring("page");
    const t = elapsed / 1000;
    const before = Math.max(0, t - 0.004);
    const after = t + 0.004;
    const progress = (time: number) => springAt(page, time, spec.velocity);
    return ((spec.to - spec.from) * (progress(after) - progress(before))) / (after - before);
  }

  /** Puts the strip itself at `position` now. */
  #show(position: number): void {
    this.#position = position;
    if (this.#strip) this.#strip.style.transform = stripAt(position);
    this.#turns.set(position, this.#order.length);
    this.#writeKnots();
    this.#showNewTab();
  }

  /**
   * Writes the knots the hold follows the proxy by, where they changed: into its scroll-linked
   * animation, or as its place where the browser has no scroll timelines.
   */
  #writeKnots(force = false): void {
    const hold = this.#hold;
    const knots = this.#turns.knots;
    if (hold === null || (!force && sameKnots(knots, this.#knots))) return;
    this.#knots = knots;
    const timeline = this.#timeline;
    if (timeline === null) {
      hold.style.transform = holdAt(this.#offset());
    } else {
      const frames = keyed(knots).map((key) => ({
        offset: key.at,
        transform: holdAt(key.offset),
        easing: "linear",
      }));
      if (this.#follow === null) this.#follow = hold.animate(frames, { timeline, fill: "both" });
      else (this.#follow.effect as KeyframeEffect).setKeyframes(frames);
    }
    // Who mirrors the hold (`surfaces/ride.ts`) reads the change off this.
    hold.setAttribute("data-knots", knots.map((knot) => `${knot.slot}:${knot.offset}`).join(" "));
    this.#linkNewTab();
  }

  /** How much of the new Cell's page shows with the strip on screen at `position`, 0 to 1. */
  #newCellShown(position: number): number {
    const slot = this.#newCell.id === null ? -1 : this.#slotOf(this.#newCell.id);
    return slot < 0 ? 0 : Math.min(Math.max(1 - Math.abs(position - slot), 0), 1);
  }

  /** The new Cell's tab shows as much as its page does where the strip is on screen. */
  #showNewTab(): void {
    const tab = this.#newCell.tab.current;
    if (tab === null) return;
    const shown = this.#newCellShown(this.#position + this.#offset());
    tab.style.setProperty("--stemcells-shown", String(shown));
    tab.style.visibility = shown > 0 ? "" : "hidden";
  }

  /** The new Cell's tab follows the proxy as its page does, by the same knots. */
  #linkNewTab(): void {
    this.#showNewTab();
    const tab = this.#newCell.tab.current;
    const timeline = this.#timeline;
    const keys =
      tab === null || timeline === null
        ? []
        : keyed(this.#knots).map((key) => ({
            offset: key.at,
            ...this.#newTabKey(this.#position + key.offset),
          }));
    const follows = keys.some((key) => key["--stemcells-shown"] !== keys[0]!["--stemcells-shown"]);
    const linked = follows && tab !== null ? { tab, keys: JSON.stringify(keys) } : null;
    if (linked?.tab === this.#tabLinked?.tab && linked?.keys === this.#tabLinked?.keys) return;
    this.#tabFollow?.cancel();
    this.#tabFollow = null;
    this.#tabLinked = linked;
    if (linked === null || timeline === null) return;
    this.#tabFollow = linked.tab.animate(keys, { timeline, fill: "both" });
  }

  #newTabKey(position: number): { "--stemcells-shown": number; visibility: string } {
    const shown = this.#newCellShown(position);
    return { "--stemcells-shown": shown, visibility: shown > 0 ? "visible" : "hidden" };
  }

  #stopSlide(): void {
    this.#slide?.cancel();
    this.#slide = null;
    this.#slideSpring = null;
    this.#tabSlide?.cancel();
    this.#tabSlide = null;
  }

  #cut(slot: number): void {
    this.#aimAt(slot);
    this.#stopSlide();
    this.#standIn = null;
    this.#placeAll();
    this.#show(slot);
    this.#moved();
  }

  /** Slides from `here`, moving at `pagesPerSecond`, to `tabId`'s page; a far one comes in as the next page. */
  #travelTo(
    tabId: string,
    here: number | null,
    stage: string | null,
    pagesPerSecond: number,
  ): void {
    const to = this.#order.indexOf(tabId);
    this.#aimAt(to);
    if (here === null || stage === null) {
      this.#cut(to);
      return;
    }
    const near = Math.round(here);
    let from = here;
    this.#standIn = null;
    if (Math.abs(to - near) > 1 && stage !== tabId) {
      const slot = to - Math.sign(to - near);
      const covers = this.#order[slot] ?? null;
      this.#standIn = { tab: stage, slot, covers: covers === stage ? null : covers };
      from = here - near + slot;
    }
    this.#placeAll();
    this.#travel(from, to, pagesPerSecond);
  }

  /** Springs the strip itself from `from` to page `to`, setting off at `pagesPerSecond`; `tookOver`, from a slide just stopped. */
  #travel(from: number, to: number, pagesPerSecond: number, tookOver = false): void {
    const strip = this.#strip;
    const takesOver = tookOver || this.#slide !== null;
    this.#stopSlide();
    this.#show(to);
    if (strip === null || this.#near(from, to)) {
      this.#settle();
      this.#moved();
      return;
    }
    let slide: Animation;
    if (reducedMotion()) {
      // Only what tracks a finger travels; anything else fades.
      const fade = timed("fade");
      slide = strip.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fade.duration,
        easing: fade.easing,
      });
    } else {
      const page = spring("page");
      const velocity = releaseVelocity(from, to, pagesPerSecond, (2 * Math.PI) / page.response);
      const timing = {
        duration: settledDuration(page, velocity) * 1000,
        easing: cssLinear(page, velocity),
      };
      slide = strip.animate([{ transform: stripAt(from) }, { transform: stripAt(to) }], timing);
      this.#slideSpring = { from, to, velocity };
      this.#slideNewTab(from, to, timing);
    }
    if (takesOver) {
      // From the frame it took over in, where the slide it ends left the
      // strip: left to wait for a frame, it would stand still while the
      // turn renders.
      const now = document.timeline.currentTime;
      slide.startTime = now;
      if (this.#tabSlide) this.#tabSlide.startTime = now;
    }
    this.#slide = slide;
    this.#moved();
    slide.onfinish = () => {
      if (this.#slide !== slide) return;
      this.#slide = null;
      this.#slideSpring = null;
      this.#tabSlide = null;
      this.#settle();
      this.#moved();
      this.#decide();
    };
  }

  /** The new Cell's tab slides alongside the strip, from `from` to `to`, on the same spring. */
  #slideNewTab(from: number, to: number, timing: KeyframeAnimationOptions): void {
    const tab = this.#newCell.tab.current;
    const offset = this.#offset();
    const start = this.#newTabKey(from + offset);
    const end = this.#newTabKey(to + offset);
    if (tab === null || start["--stemcells-shown"] === end["--stemcells-shown"]) return;
    this.#tabSlide = tab.animate([start, end], timing);
  }

  /** Whether two places of the strip (pages) are too near on screen for a slide between them. */
  #near(a: number, b: number): boolean {
    return Math.abs(a - b) * (this.#strip?.clientWidth ?? 0) < NO_SLIDE;
  }

  /** At rest: a stand-in goes back to its own place, and the strip with it if it is on stage. */
  #settle(): void {
    if (this.#standIn === null) return;
    const stage = this.#tabAt(Math.round(this.#position));
    this.#standIn = null;
    this.#placeAll();
    if (stage !== null) this.#show(this.#slotOf(stage));
  }

  /** Marks the pages moving while the proxy is off its rest or a slide runs, and at rest once neither is. */
  #moved(): void {
    const moving = !this.#turns.resting || this.#slide !== null;
    this.#scroller?.toggleAttribute("data-moving", moving);
    if (moving === this.#moving) return;
    this.#moving = moving;
    this.#newCell.onMotion(moving);
  }

  /**
   * After the rules moved the strip's place or its knots: the knots go to the hold, and the
   * strip takes by a spring whatever that would otherwise show as a jump, so the picture holds.
   */
  #apply(): void {
    const place = this.#turns.place;
    const knots = this.#turns.knots;
    if (place === this.#position && sameKnots(knots, this.#knots)) return;
    const shown = this.#onScreen();
    const own = this.#own();
    const speed = this.#speed();
    this.#writeKnots();
    const from = shown - offsetAt(knots, this.#slot());
    if (place === this.#position && this.#near(from, own)) return;
    this.#travel(from, place, speed, true);
  }

  /**
   * The tab to turn to now, if it is not the active one nor asked for already: the one the strip
   * has landed on, or the one it is headed for once that is two pages off, so the page after it
   * is mounted before a third swipe brings it in.
   */
  #due(): string | null {
    const heading = this.#turns.heading;
    const tabId = this.#tabAt(heading);
    if (tabId === null || tabId === this.#active || this.#asked.includes(tabId)) return null;
    const far = this.#active !== null && Math.abs(heading - this.#slotOf(this.#active)) >= 2;
    const width = this.#slotWidth();
    const landed = this.#slide === null && width !== 0 && this.#turns.landed(1 / width);
    return far || landed ? tabId : null;
  }

  /**
   * Hears where the strip is headed, and turns to the page it has landed on. The tab turns once
   * the page is there, not at the lift: a turn renders, focuses and mounts pages, none of which
   * the strip in flight should share its frames with, and a field focused on a page still
   * arriving would scroll the proxy to meet it.
   */
  #decide(): void {
    this.#aimAt(this.#turns.heading);
    if (this.#due() === null || this.#turning !== 0) return;
    // A frame on: the proxy is back at rest for the next touch before the turn's render holds the page.
    this.#turning = requestAnimationFrame(() =>
      setTimeout(() => {
        this.#turning = 0;
        const tabId = this.#scroller === null ? null : this.#due();
        if (tabId === null) return;
        this.#asked.push(tabId);
        this.#turn(tabId);
      }, 0),
    );
  }

  readonly #onWheel = (event: WheelEvent): void => {
    this.#fingers = true;
    const scroller = this.#scroller;
    if (scroller === null) return;
    // Whose the gesture is, as the browser decides it: the proxy's if it goes sideways and
    // nothing under the pointer takes it first.
    const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const ours =
      sideways &&
      !event.defaultPrevented &&
      !event.ctrlKey &&
      !scrollerTakes(event.target, scroller, event.deltaX > 0 ? 1 : -1);
    this.#turns.wheel(event.timeStamp, ours);
    // A second touch's first move takes the walls for its own.
    this.#apply();
  };

  readonly #onTouch = (): void => {
    this.#fingers = true;
  };

  readonly #onScroll = (): void => {
    const width = this.#slotWidth();
    if (width === 0) return;
    const slot = this.#scrolledTo();
    if (!this.#fingers) {
      // Not the fingers: a field focused or a key pressed scrolled the proxy to show something.
      // Back it goes, in the frame it moved in.
      if (Math.abs(slot - this.#turns.origin) * width > 0.5) this.#toOrigin();
      return;
    }
    this.#turns.scrolled(slot, 1 / width, performance.now());
    if (!SAYS_AIM) this.#turns.aimed(Math.round(slot));
    if (!SAYS_REST) {
      clearTimeout(this.#restTimer);
      this.#restTimer = setTimeout(this.#onRest, REST_AFTER);
    }
    if (this.#timeline === null && this.#hold) {
      this.#hold.style.transform = holdAt(this.#offset());
      this.#showNewTab();
    }
    this.#apply();
    this.#moved();
    this.#decide();
  };

  readonly #onAim = (event: Event): void => {
    const target = (event as Event & { snapTargetInline?: Element | null }).snapTargetInline;
    const slot = Number(target?.getAttribute("data-stemcells-proxy-slot") ?? Number.NaN);
    // Only the fingers' scroll aims the strip: any other is on its way back to the origin.
    if (!this.#fingers || !Number.isFinite(slot)) return;
    this.#turns.aimed(slot);
    this.#decide();
  };

  /** The proxy came to rest: what it shows folds into the strip's own place, and it goes back to its rest slot. */
  readonly #onRest = (): void => {
    const width = this.#slotWidth();
    if (width === 0) return;
    const fingers = this.#fingers;
    this.#fingers = false;
    if (!fingers) {
      this.#toOrigin();
      return;
    }
    const shown = this.#onScreen();
    const speed = this.#speed();
    this.#turns.rested(this.#scrolledTo(), performance.now());
    this.#toOrigin();
    this.#writeKnots();
    this.#travel(shown, this.#turns.place, speed, this.#slide !== null);
    // A turn asked for on the way to another page than this one is no longer on its way.
    const here = this.#tabAt(this.#turns.place);
    this.#asked = this.#asked.filter((tabId) => tabId === here);
    this.#moved();
    this.#decide();
  };

  /** The system's phases of a scroll: when a touch begins, lifts and coasts, which the rules about touches go by. */
  readonly #onPhases = (scroll: ScrollPhases): void => {
    this.#turns.phases(scroll);
    this.#apply();
    this.#moved();
    if (!this.#turns.owing || this.#paying !== 0) return;
    // Two frames on: by then the page has heard where the proxy is going since the lift.
    this.#paying = requestAnimationFrame(() => {
      this.#paying = requestAnimationFrame(() => {
        this.#paying = 0;
        this.#turns.pay();
        this.#apply();
        this.#moved();
        this.#decide();
      });
    });
  };
}
