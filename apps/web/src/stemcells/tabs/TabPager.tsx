import { createContext, use, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { reducedMotion, spring, timed } from "../tokens/motion.ts";
import { cssLinear, settledDuration } from "../tokens/spring.ts";
import {
  dragBy,
  dragPosition,
  releaseTarget,
  releaseVelocity,
  startDrag,
  type Drag,
} from "./pager";
import { LIFT_GAP, SwipeLatch, WheelContact, type ContactSource } from "./swipe";

/**
 * The tabs' pages side by side on one strip across the slate, and the
 * two-finger swipe that travels between them. The strip moves with the
 * fingers, one transform written once a frame, with nothing re-rendering;
 * letting go springs it to a page, and the tab turns once that slide is
 * under way. A turn by other means (a click, a key, a route) slides too.
 *
 * The page on stage is the active tab's. The others are inert: only the
 * page on stage takes the pointer, the keyboard and focus.
 */
export function TabPager(props: {
  /** Every tab, in the strip's order: a tab's place is its index. */
  tabIds: readonly string[];
  activeId: string;
  /** Turns to a tab a swipe went to. */
  onTurn: (tabId: string) => void;
  /** A `PagerPage` for each tab whose page is mounted, the active one among them. */
  children: ReactNode;
}) {
  const [strip] = useState(() => new PageStrip());
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (viewportRef.current === null || stripRef.current === null) return;
    strip.attach(viewportRef.current, stripRef.current);
    return () => strip.detach();
  }, [strip]);

  useLayoutEffect(() => {
    strip.sync(props.tabIds, props.activeId, props.onTurn);
  });

  return (
    <div ref={viewportRef} data-stemcells-pages="">
      <div ref={stripRef} data-stemcells-strip="">
        <PageStripContext value={strip}>{props.children}</PageStripContext>
      </div>
    </div>
  );
}

const PageStripContext = createContext<PageStrip | null>(null);

/** A tab's page on the strip. Only the one on stage takes input. */
export function PagerPage(props: { tabId: string; onStage: boolean; children: ReactNode }) {
  const strip = use(PageStripContext);
  const { tabId } = props;
  return (
    <div
      ref={(node) => {
        strip?.setPage(tabId, node);
        return () => strip?.setPage(tabId, null);
      }}
      data-stemcells-page={tabId}
      data-on-stage={props.onStage}
      inert={!props.onStage}
    >
      {props.children}
    </div>
  );
}

/** The strip at `position` (in pages): page `i` is on stage at `i`. */
const stripAt = (position: number): string => `translate3d(${-position * 100}%, 0, 0)`;
/** A page in its place on the strip. */
const pageAt = (slot: number): string => `translate3d(${slot * 100}%, 0, 0)`;

/** Whether input is waiting to be handled, where the browser can say (Chromium can). */
function inputPending(): boolean {
  const scheduling = (
    navigator as Navigator & {
      scheduling?: { isInputPending?: (options?: { includeContinuous?: boolean }) => boolean };
    }
  ).scheduling;
  return scheduling?.isInputPending?.({ includeContinuous: true }) === true;
}

/** How far back (ms) the strip's moves count toward its speed when the fingers lift. */
const SPEED_WINDOW = 60;

/**
 * Whether something under `target`, inside `boundary`, scrolls sideways in
 * `direction` and has room to: then the gesture is its, not the pager's.
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

/**
 * The strip itself: where it is, the pages on it, and the gesture moving
 * it. It writes to the DOM directly, so a swipe never waits on React.
 */
class PageStrip {
  #viewport: HTMLElement | null = null;
  #strip: HTMLElement | null = null;
  readonly #pages = new Map<string, HTMLElement>();
  #order: readonly string[] = [];
  #active: string | null = null;
  /** The tab the strip is on, or on its way to. */
  #heading: string | null = null;
  /** Where the strip is when no slide runs: at rest, or held by the fingers. */
  #position = 0;
  #slide: Animation | null = null;
  /**
   * A turn to a tab further than the next one: the page being left stands
   * in beside the page arriving, over the page that is really there, so the
   * slide is one page long instead of passing every page between.
   */
  #standIn: { readonly tab: string; readonly slot: number; readonly covers: string | null } | null =
    null;
  #turn: (tabId: string) => void = () => undefined;

  readonly #source: ContactSource = new WheelContact();
  #latch: SwipeLatch | null = null;
  #drag: Drag | null = null;
  /** The strip's recent positions while held, for its speed when let go. */
  #trail: { readonly t: number; readonly position: number }[] = [];
  #frame = 0;
  #idle: ReturnType<typeof setTimeout> | undefined;

  attach(viewport: HTMLElement, strip: HTMLElement): void {
    this.#viewport = viewport;
    this.#strip = strip;
    strip.style.transform = stripAt(this.#position);
    this.#placeAll();
    // Not passive: a swipe the pager owns must not also scroll the chat under it.
    viewport.addEventListener("wheel", this.#onWheel, { passive: false });
  }

  detach(): void {
    this.#viewport?.removeEventListener("wheel", this.#onWheel);
    this.#slide?.cancel();
    this.#slide = null;
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    clearTimeout(this.#idle);
    this.#viewport = null;
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
  sync(order: readonly string[], active: string, turn: (tabId: string) => void): void {
    this.#turn = turn;
    if (this.#active === null) {
      this.#order = order;
      this.#active = active;
      this.#heading = active;
      this.#placeAll();
      this.#show(this.#slotOf(active));
      return;
    }
    // Where the eye has the strip: the tab on stage, and how far off it.
    const at = this.#onScreen();
    const stage = this.#tabAt(Math.round(at));
    const offStage = stage === null ? 0 : at - this.#slotOf(stage);
    const reordered =
      order.length !== this.#order.length || order.some((id, i) => id !== this.#order[i]);
    const turned = active !== this.#active;
    this.#order = order;
    this.#active = active;
    if (reordered) this.#standIn = null;
    this.#placeAll();
    if (!turned && !reordered) return;
    const stageSlot = stage === null ? -1 : this.#slotOf(stage);
    const here = stageSlot < 0 ? null : stageSlot + offStage;
    if (turned && active !== this.#heading) {
      // A turn by other means. Fingers on the strip give it up.
      this.#latch?.spend();
      this.#drag = null;
      this.#travelTo(active, here, stage);
      return;
    }
    // A swipe's own turn landing, or tabs that moved under the strip: the
    // strip keeps the page on stage where the eye has it.
    const heading = this.#heading ?? active;
    if (here === null || this.#slotOf(heading) < 0) {
      this.#heading = active;
      this.#cut(this.#slotOf(active));
    } else if (Math.abs(here - at) > 1e-6) {
      const sliding = this.#slide !== null;
      this.#slide?.cancel();
      this.#slide = null;
      this.#show(here);
      if (this.#drag) this.#grab();
      else if (sliding) this.#travel(here, this.#slotOf(heading), 0);
      else this.#show(this.#slotOf(heading));
    }
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

  /** Where the strip is on screen, a slide included. */
  #onScreen(): number {
    const strip = this.#strip;
    if (this.#slide === null || strip === null) return this.#position;
    const width = strip.clientWidth;
    const transform = getComputedStyle(strip).transform;
    if (width === 0 || transform === "none") return this.#position;
    return -new DOMMatrixReadOnly(transform).m41 / width;
  }

  /** Puts the strip at `position` now. */
  #show(position: number): void {
    this.#position = position;
    if (this.#strip) this.#strip.style.transform = stripAt(position);
  }

  /** Puts the strip at its position on the next frame: once a frame, however many events came. */
  #schedule(): void {
    if (this.#frame !== 0) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      if (this.#strip) this.#strip.style.transform = stripAt(this.#position);
    });
  }

  #cut(slot: number): void {
    this.#slide?.cancel();
    this.#slide = null;
    this.#standIn = null;
    this.#placeAll();
    this.#show(slot);
  }

  /** Slides from `here` to `tabId`'s page; a far one comes in as the next page. */
  #travelTo(tabId: string, here: number | null, stage: string | null): void {
    this.#heading = tabId;
    const to = this.#order.indexOf(tabId);
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
    this.#travel(from, to, 0);
  }

  /** Springs the strip from `from` to page `to`, setting off at `pagesPerSecond`. */
  #travel(from: number, to: number, pagesPerSecond: number): void {
    const strip = this.#strip;
    this.#slide?.cancel();
    this.#slide = null;
    this.#show(to);
    if (strip === null || Math.abs(to - from) < 1e-3) {
      this.#settle();
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
      slide = strip.animate([{ transform: stripAt(from) }, { transform: stripAt(to) }], {
        duration: settledDuration(page, velocity) * 1000,
        easing: cssLinear(page, velocity),
      });
    }
    this.#slide = slide;
    slide.onfinish = () => {
      if (this.#slide !== slide) return;
      this.#slide = null;
      this.#settle();
    };
  }

  /** At rest: a stand-in goes back to its own place, and the strip with it if it is on stage. */
  #settle(): void {
    if (this.#standIn === null) return;
    const stage = this.#tabAt(Math.round(this.#position));
    this.#standIn = null;
    this.#placeAll();
    if (stage !== null) this.#show(this.#slotOf(stage));
  }

  readonly #onWheel = (event: WheelEvent): void => {
    // Pinches, and wheels that step by lines or pages, aren't swipes.
    if (event.ctrlKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
    const viewport = this.#viewport;
    if (viewport === null) return;
    const sample = { dx: event.deltaX, dy: event.deltaY, t: event.timeStamp };
    const contact = this.#source.wheel(sample);
    clearTimeout(this.#idle);
    this.#idle = setTimeout(this.#onIdle, LIFT_GAP + 10);
    if (contact.phase === "began") {
      this.#release(0, sample.t);
      const target = event.target;
      this.#latch = new SwipeLatch((direction) => scrollerTakes(target, viewport, direction), {
        catching: this.#slide !== null,
      });
      this.#trail = [];
    }
    if (contact.phase === "began" || contact.phase === "moved") this.#move(sample);
    if (contact.phase === "lifted") this.#release(contact.coasted.dx, sample.t);
    if (this.#latch?.holds && event.cancelable) event.preventDefault();
  };

  readonly #onIdle = (): void => {
    // Events held up behind a busy page aren't a silence.
    if (inputPending()) {
      this.#idle = setTimeout(this.#onIdle, LIFT_GAP);
      return;
    }
    const now = performance.now();
    if (this.#source.idle(now)) this.#release(0, now);
  };

  #move(sample: { readonly dx: number; readonly dy: number; readonly t: number }): void {
    const latch = this.#latch;
    if (latch === null) return;
    const held = latch.owner === "pager";
    const dx = latch.move(sample.dx, sample.dy);
    if (latch.owner !== "pager") return;
    if (!held) this.#grab();
    const drag = dragBy(this.#drag!, dx);
    this.#drag = drag;
    this.#position = dragPosition(drag);
    this.#trail.push({ t: sample.t, position: this.#position });
    while (this.#trail.length > 2 && this.#trail[0]!.t < sample.t - SPEED_WINDOW) {
      this.#trail.shift();
    }
    this.#schedule();
  }

  /** The fingers take the strip where it is on screen: latest input wins. */
  #grab(): void {
    const at = this.#onScreen();
    this.#slide?.cancel();
    this.#slide = null;
    this.#show(at);
    const heading = this.#heading ?? this.#active;
    const width = this.#strip?.clientWidth ?? 0;
    this.#drag = startDrag(
      at,
      heading === null ? Math.round(at) : this.#slotOf(heading),
      this.#order.length,
      width,
    );
  }

  /** The strip's speed (pages per second) as the fingers left it, by `now`. */
  #speed(now: number): number {
    const first = this.#trail[0];
    const last = this.#trail.at(-1);
    if (!first || !last || last.t <= first.t || now - last.t > SPEED_WINDOW) return 0;
    return ((last.position - first.position) / (last.t - first.t)) * 1000;
  }

  /**
   * The fingers lifted, `coasted` px into the coast. The strip springs to
   * the page the move earned, and the tab turns once that slide is under
   * way, so its first frames are on the compositor before the turn renders.
   */
  #release(coasted: number, now: number): void {
    const drag = this.#drag;
    if (drag === null) return;
    this.#drag = null;
    const target = releaseTarget(drag, drag.travel - coasted);
    const tabId = this.#tabAt(target) ?? this.#heading;
    this.#heading = tabId;
    this.#travel(this.#position, target, this.#speed(now));
    if (tabId === null || tabId === this.#active) return;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (this.#heading === tabId && tabId !== this.#active) this.#turn(tabId);
      }, 0),
    );
  }
}
