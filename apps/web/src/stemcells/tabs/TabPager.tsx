import {
  createContext,
  use,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { reducedMotion, spring, timed } from "../tokens/motion.ts";
import { cssLinear, settledDuration, springAt } from "../tokens/spring.ts";
import { SwipeHand, type HeldStrip } from "./hand";
import { releaseVelocity } from "./pager";
import { PhasedContact, type ScrollPhases } from "./phases";
import { LIFT_GAP } from "./swipe";

/**
 * The tabs' pages side by side on one strip, and the two-finger swipe between them: one transform
 * written a frame, nothing re-rendering. Only the page on stage takes pointer, keys and focus.
 * While pages move, `[data-stemcells-pages]` carries `data-moving` for what can't move with them
 * (a native view). The new Cell's tab follows its page through `--stemcells-shown` (0 to 1).
 */
export function TabPager(props: {
  /** Every tab, in the strip's order: a tab's place is its index. */
  tabIds: readonly string[];
  activeId: string;
  /** Turns to a tab a swipe went to. */
  onTurn: (tabId: string) => void;
  /** The new Cell's page, among `tabIds`, if there is one. */
  newCellId?: string | null;
  /** Its tab in the tab bar. */
  newTabRef?: RefObject<HTMLElement | null>;
  /** The pages started moving, or came to rest (`data-moving`). */
  onMotion?: (moving: boolean) => void;
  /** A `PagerPage` for each tab whose page is mounted, the active one among them. */
  children: ReactNode;
}) {
  const [strip] = useState(() => new PageStrip());
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // oxlint-disable-next-line t3code/react-effect-budget -- Attach the page strip to its viewport; detach on unmount.
  useLayoutEffect(() => {
    if (viewportRef.current === null || stripRef.current === null) return;
    strip.attach(viewportRef.current, stripRef.current);
    return () => strip.detach();
  }, [strip]);

  // oxlint-disable-next-line t3code/react-effect-budget -- Hand the strip this render's tabs and callbacks before paint.
  useLayoutEffect(() => {
    strip.sync(props.tabIds, props.activeId, props.onTurn, {
      id: props.newCellId ?? NO_NEW_CELL.id,
      tab: props.newTabRef ?? NO_NEW_CELL.tab,
      onMotion: props.onMotion ?? NO_NEW_CELL.onMotion,
    });
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

/** The new Cell's page, and what follows it (`TabPager`). */
interface NewCellPage {
  readonly id: string | null;
  readonly tab: RefObject<HTMLElement | null>;
  readonly onMotion: (moving: boolean) => void;
}

const NO_NEW_CELL: NewCellPage = { id: null, tab: { current: null }, onMotion: () => undefined };

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

/** How long (ms) after the last wheel event the page keeps watching the frames it draws, so the next event knows what it could hear. */
const LISTEN_FOR = 600;
/** No frame drawn for this long (ms): the page was busy, and couldn't hear wheel events. */
const BUSY = 40;

/**
 * Whether something under `target`, inside `boundary`, scrolls sideways in
 * `direction` and has room to: then the gesture is its, not the pager's.
 * A border between Cells keeps the gesture too: a swipe never starts from
 * one (`split/Separator.tsx`).
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
    if (element.hasAttribute("data-stemcells-split")) return true;
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

  readonly #contact = new PhasedContact();
  readonly #hand = new SwipeHand(this.#held(), this.#contact);
  /** Stops the desktop app's scroll phases coming, where it sends them. */
  #unphase: (() => void) | undefined;
  #frame = 0;
  #idle: ReturnType<typeof setTimeout> | undefined;
  /** The last frame drawn while wheel events come. */
  #lastFrame: number | undefined;
  /** Since the last wheel event: when the page first went `BUSY` without drawing, if it did. */
  #busyFrom: number | undefined;
  #beat = 0;
  #listenUntil = 0;

  attach(viewport: HTMLElement, strip: HTMLElement): void {
    this.#viewport = viewport;
    this.#strip = strip;
    strip.style.transform = stripAt(this.#position);
    this.#placeAll();
    // Not passive: a swipe the pager owns must not also scroll the chat under it.
    viewport.addEventListener("wheel", this.#onWheel, { passive: false });
    this.#unphase = window.stemcellsScrollPhases?.subscribe(this.#onScroll);
  }

  detach(): void {
    this.#viewport?.removeEventListener("wheel", this.#onWheel);
    this.#unphase?.();
    this.#unphase = undefined;
    this.#viewport?.removeAttribute("data-moving");
    this.#moving = false;
    this.#stopSlide();
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    cancelAnimationFrame(this.#beat);
    this.#beat = 0;
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
  sync(
    order: readonly string[],
    active: string,
    turn: (tabId: string) => void,
    newCell: NewCellPage,
  ): void {
    this.#turn = turn;
    this.#newCell = newCell;
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
    const speed = this.#speed();
    const stage = this.#tabAt(Math.round(at));
    const offStage = stage === null ? 0 : at - this.#slotOf(stage);
    const reordered =
      order.length !== this.#order.length || order.some((id, i) => id !== this.#order[i]);
    const turned = active !== this.#active;
    this.#order = order;
    this.#active = active;
    if (reordered) this.#standIn = null;
    this.#placeAll();
    if (this.#slide === null) this.#showNewTab(this.#position);
    if (!turned && !reordered) return;
    const stageSlot = stage === null ? -1 : this.#slotOf(stage);
    const here = stageSlot < 0 ? null : stageSlot + offStage;
    if (turned && active !== this.#heading) {
      // A turn by other means. Fingers on the strip give it up.
      this.#hand.spend();
      this.#travelTo(active, here, stage, speed);
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
      this.#stopSlide();
      this.#show(here);
      if (this.#hand.holding) this.#hand.regrab();
      else if (sliding) this.#travel(here, this.#slotOf(heading), speed, true);
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

  /** How fast the strip moves now, in pages a second toward later pages: a slide's speed, or none. */
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

  /** Puts the strip at `position` now. */
  #show(position: number): void {
    this.#position = position;
    if (this.#strip) this.#strip.style.transform = stripAt(position);
    this.#showNewTab(position);
  }

  /** Puts the strip at its position on the next frame: once a frame, however many events came. */
  #schedule(): void {
    if (this.#frame !== 0) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      if (this.#strip) this.#strip.style.transform = stripAt(this.#position);
      this.#showNewTab(this.#position);
    });
  }

  /** How much of the new Cell's page shows with the strip at `position`, 0 to 1. */
  #newCellShown(position: number): number {
    const slot = this.#newCell.id === null ? -1 : this.#slotOf(this.#newCell.id);
    return slot < 0 ? 0 : Math.min(Math.max(1 - Math.abs(position - slot), 0), 1);
  }

  /** The new Cell's tab shows as much as its page does with the strip at `position`. */
  #showNewTab(position: number): void {
    const tab = this.#newCell.tab.current;
    if (tab === null) return;
    const shown = this.#newCellShown(position);
    tab.style.setProperty("--stemcells-shown", String(shown));
    tab.style.visibility = shown > 0 ? "" : "hidden";
  }

  #stopSlide(): void {
    this.#slide?.cancel();
    this.#slide = null;
    this.#slideSpring = null;
    this.#tabSlide?.cancel();
    this.#tabSlide = null;
  }

  #cut(slot: number): void {
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
    this.#travel(from, to, pagesPerSecond);
  }

  /** Springs the strip from `from` to page `to`, setting off at `pagesPerSecond`; `tookOver`, from a slide just stopped. */
  #travel(from: number, to: number, pagesPerSecond: number, tookOver = false): void {
    const strip = this.#strip;
    const takesOver = tookOver || this.#slide !== null;
    this.#stopSlide();
    this.#show(to);
    if (strip === null || Math.abs(to - from) < 1e-3) {
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
    };
  }

  /** The new Cell's tab slides alongside the strip, from `from` to `to`, on the same spring. */
  #slideNewTab(from: number, to: number, timing: KeyframeAnimationOptions): void {
    const tab = this.#newCell.tab.current;
    const start = this.#newCellShown(from);
    const end = this.#newCellShown(to);
    if (tab === null || start === end) return;
    const keyframe = (shown: number): Keyframe => ({
      "--stemcells-shown": shown,
      visibility: shown > 0 ? "visible" : "hidden",
    });
    this.#tabSlide = tab.animate([keyframe(start), keyframe(end)], timing);
  }

  /** At rest: a stand-in goes back to its own place, and the strip with it if it is on stage. */
  #settle(): void {
    if (this.#standIn === null) return;
    const stage = this.#tabAt(Math.round(this.#position));
    this.#standIn = null;
    this.#placeAll();
    if (stage !== null) this.#show(this.#slotOf(stage));
  }

  /** Marks the pages moving while the fingers hold the strip or a slide runs, and at rest once neither does. */
  #moved(): void {
    const moving = this.#hand.holding || this.#slide !== null;
    this.#viewport?.toggleAttribute("data-moving", moving);
    if (moving === this.#moving) return;
    this.#moving = moving;
    this.#newCell.onMotion(moving);
  }

  /** The strip as the hand holds it. */
  #held(): HeldStrip {
    return {
      at: () => this.#onScreen(),
      sliding: () => this.#slide !== null,
      heading: () => {
        const heading = this.#heading ?? this.#active;
        const slot = heading === null ? -1 : this.#slotOf(heading);
        return slot < 0 ? null : slot;
      },
      count: () => this.#order.length,
      width: () => this.#strip?.clientWidth ?? 0,
      grab: (at) => {
        this.#stopSlide();
        this.#show(at);
      },
      hold: (position) => {
        this.#position = position;
        this.#schedule();
      },
      release: (from, to, pagesPerSecond) => this.#release(from, to, pagesPerSecond),
    };
  }

  readonly #onWheel = (event: WheelEvent): void => {
    // Pinches, and wheels that step by lines or pages, aren't swipes; nor is
    // anything while a border between Cells is held (`split/Separator.tsx`).
    if (event.ctrlKey || event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
    if (document.documentElement.hasAttribute("data-stemcells-splitting")) return;
    const viewport = this.#viewport;
    if (viewport === null) return;
    const sample = {
      dx: event.deltaX,
      dy: event.deltaY,
      t: event.timeStamp,
      heard: this.#heard(),
      got: performance.now(),
    };
    this.#listen(event.timeStamp);
    clearTimeout(this.#idle);
    this.#idle = setTimeout(this.#onIdle, LIFT_GAP + 10);
    const target = event.target;
    const holds = this.#hand.wheel(sample, (direction) =>
      scrollerTakes(target, viewport, direction),
    );
    if (holds && event.cancelable) event.preventDefault();
    this.#moved();
  };

  /**
   * Until when the page could hear wheel events since the last one: the
   * frame before it first went busy, if it did. A wheel event that comes
   * after a busy stretch carries what came meanwhile, so the gap before it
   * is a silence only up to there.
   */
  #heard(): number | undefined {
    const last = this.#lastFrame;
    if (this.#busyFrom === undefined && last !== undefined && performance.now() - last > BUSY) {
      this.#busyFrom = last;
    }
    const heard = this.#busyFrom;
    this.#busyFrom = undefined;
    return heard;
  }

  /** Watches the frames drawn until a while after `now`. */
  #listen(now: number): void {
    this.#listenUntil = now + LISTEN_FOR;
    if (this.#beat !== 0) return;
    this.#lastFrame = undefined;
    this.#beat = requestAnimationFrame(this.#onBeat);
  }

  readonly #onBeat = (time: number): void => {
    const last = this.#lastFrame;
    if (this.#busyFrom === undefined && last !== undefined && time - last > BUSY) {
      this.#busyFrom = last;
    }
    this.#lastFrame = time;
    this.#beat = time < this.#listenUntil ? requestAnimationFrame(this.#onBeat) : 0;
  };

  /** The system's phases of a scroll: when they say the fingers lifted, the strip lets go at once. */
  readonly #onScroll = (scroll: ScrollPhases): void => {
    const lift = this.#contact.scroll(scroll);
    if (lift === null) return;
    this.#hand.lift(lift.coasted.dx, scroll.t);
    this.#moved();
  };

  readonly #onIdle = (): void => {
    // Events held up behind a busy page aren't a silence.
    if (inputPending()) {
      this.#idle = setTimeout(this.#onIdle, LIFT_GAP);
      return;
    }
    this.#hand.idle(performance.now());
    this.#moved();
  };

  /**
   * The fingers lifted: the strip springs from `from` to page `to`, and the
   * tab turns once that slide is under way, so its first frames are on the
   * compositor before the turn renders.
   */
  #release(from: number, to: number, pagesPerSecond: number): void {
    const tabId = this.#tabAt(to) ?? this.#heading;
    this.#heading = tabId;
    this.#travel(from, to, pagesPerSecond);
    if (tabId === null || tabId === this.#active) return;
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (this.#heading === tabId && tabId !== this.#active) this.#turn(tabId);
      }, 0),
    );
  }
}
