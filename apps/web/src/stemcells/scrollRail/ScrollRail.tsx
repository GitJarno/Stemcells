/**
 * The scroll rail: one quiet thumb at the right edge of a chat, or of the
 * settings on the slab, in place of the system's bar. A Mac set to show
 * scroll bars always drew that bar as a gray track the chat's whole height,
 * under the pane's buttons and past the composer, and kept its width out of
 * both edges. The rail runs between those, whatever the system's setting.
 * The thumb shows while the reader scrolls and fades after; under the hand
 * it widens over its track, and drags like a bar's thumb. A press on the
 * track glides there. In a chat, T3's ask marks (its timeline minimap)
 * stand beside it (`scrollRail.css`).
 */
import { reducedMotion, spring, timing } from "../tokens/motion";
import { settledDuration, springAt } from "../tokens/spring";
import { forwardWheelToTimeline, observeResize } from "../upstream/scrollRail";
import { scrollTopAt, shareAt, thumbOn, trackEnds, type Thumb } from "./rail";

import "./scrollRail.css";

/** What a rail scrolls in the box it stands in, and what floats over that scroller's foot. */
interface Scrolls {
  readonly scroller: string;
  readonly foot: string | null;
}

const CHAT: Scrolls = {
  scroller: ".messages-timeline-scroll",
  foot: '[data-chat-composer-overlay="true"]',
};
const SETTINGS: Scrolls = { scroller: "[data-settings-page-scroll]", foot: null };

/** One attach per kind, so a rail's ref stays the same across renders. */
const ATTACH = {
  chat: (rail: HTMLDivElement | null) => attachScrollRail(rail, CHAT),
  settings: (rail: HTMLDivElement | null) => attachScrollRail(rail, SETTINGS),
};

/**
 * How long after the reader's own wheel, key or press a scroll counts as
 * theirs. A reply the list follows to its end scrolls too, many times a
 * second, and shows no rail.
 */
const INTENT_MS = 400;
/** Keys that scroll when no field holds them. */
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);
/** How far a press on the track moves before it drags rather than glides. */
const DRAG_SLOP = 3;

/** A rail at the right edge of its parent, which is positioned and holds the scroller. */
export function ScrollRail(props: { kind: keyof typeof ATTACH }) {
  return (
    <div ref={ATTACH[props.kind]} data-stemcells-scroll-rail={props.kind} aria-hidden="true">
      <div data-stemcells-scroll-rail-thumb="" />
    </div>
  );
}

function attachScrollRail(rail: HTMLDivElement | null, scrolls: Scrolls): (() => void) | undefined {
  const box = rail?.parentElement;
  const mark = rail?.firstElementChild;
  if (!rail || !box || !(mark instanceof HTMLElement)) return undefined;

  let scroller: HTMLElement | null = null;
  let foot: HTMLElement | null = null;
  let stopWatching = () => {};
  let thumb: Thumb | null = null;
  let track = 0;
  let least: number | null = null;
  let linger: number | null = null;
  let headAt = -1;
  let footAt = -1;
  let intentAt = -Infinity;
  let hovered = false;
  let hideTimer = 0;
  let glide = 0;
  let drag: {
    readonly pointer: number;
    readonly grab: number;
    readonly from: number;
    moved: boolean;
  } | null = null;

  const held = (element: HTMLElement | null) =>
    element?.isConnected && box.contains(element) ? element : null;

  /** The scroller and what floats over its foot, watched for size while they stand. */
  const find = () => {
    const nextScroller = held(scroller) ?? box.querySelector<HTMLElement>(scrolls.scroller);
    const nextFoot =
      scrolls.foot === null ? null : (held(foot) ?? box.querySelector<HTMLElement>(scrolls.foot));
    if (nextScroller === scroller && nextFoot === foot) return scroller;
    scroller = nextScroller;
    foot = nextFoot;
    stopWatching();
    // The content grows as rows measure and replies stream; the composer
    // grows with its draft.
    const watched = [rail, scroller, scroller?.firstElementChild, foot].filter(
      (element): element is Element => element instanceof Element,
    );
    stopWatching = observeResize(watched, () => {
      measure();
      paint(rail.hasAttribute("data-shown"));
    });
    return scroller;
  };

  /** Where the track runs: the stylesheet places it from where the scroller and its foot stand. */
  const measure = () => {
    const target = find();
    if (!target) return;
    const outer = box.getBoundingClientRect();
    const ends = trackEnds(
      { top: outer.top + box.clientTop, bottom: outer.bottom },
      target.getBoundingClientRect(),
      foot?.getBoundingClientRect().top ?? null,
    );
    if (ends.head !== headAt || ends.foot !== footAt) {
      headAt = ends.head;
      footAt = ends.foot;
      rail.style.setProperty("--sc-scroll-rail-head", `${headAt}px`);
      rail.style.setProperty("--sc-scroll-rail-foot", `${footAt}px`);
    }
    track = rail.clientHeight;
  };

  /** Where the thumb stands, drawn when it shows. */
  const paint = (draw: boolean) => {
    // The least thumb is a token, which the stylesheet gives the thumb.
    least ??= Number.parseFloat(getComputedStyle(mark).minHeight) || 0;
    thumb = scroller ? thumbOn(scroller, track, least) : null;
    rail.toggleAttribute("data-scrolls", thumb !== null);
    if (!thumb || !draw) return;
    mark.style.height = `${thumb.length}px`;
    mark.style.transform = `translateY(${thumb.offset}px)`;
  };

  const hide = () => {
    hideTimer = 0;
    rail.removeAttribute("data-shown");
  };
  /** Shows the rail, and fades it after a while unless a hand is on it. */
  const show = () => {
    window.clearTimeout(hideTimer);
    hideTimer = 0;
    if (!thumb) return hide();
    rail.setAttribute("data-shown", "");
    // Half a notice's linger: a glance at where you are.
    linger ??= timing("linger") / 2;
    if (!hovered && !drag) hideTimer = window.setTimeout(hide, linger);
  };
  const light = () => rail.toggleAttribute("data-lit", hovered || drag !== null);

  const intend = () => {
    intentAt = performance.now();
  };
  const stopGlide = () => {
    cancelAnimationFrame(glide);
    glide = 0;
  };
  /**
   * Carries the scroller to `share` of the way through on the travel spring,
   * by its share rather than its pixels: rows measured on the way change
   * its length. Reduce Motion jumps.
   */
  const glideTo = (target: HTMLElement, share: number) => {
    stopGlide();
    const travel = () => Math.max(0, target.scrollHeight - target.clientHeight);
    if (reducedMotion()) {
      target.scrollTop = share * travel();
      return;
    }
    const from = travel() > 0 ? target.scrollTop / travel() : 0;
    const motion = spring("travel");
    const settled = settledDuration(motion);
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      const progress = t >= settled ? 1 : springAt(motion, t);
      intend();
      target.scrollTop = (from + (share - from) * progress) * travel();
      glide = progress === 1 ? 0 : requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };
  // The reader's own wheel, finger, key or press takes the chat from a glide.
  const takeOver = () => {
    stopGlide();
    intend();
  };

  const onScroll = (event: Event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches(scrolls.scroller)) return;
    const shown = rail.hasAttribute("data-shown");
    const theirs = hovered || drag !== null || performance.now() - intentAt < INTENT_MS;
    if (event.target !== scroller || !shown) measure();
    paint(shown || theirs);
    if (theirs) show();
  };
  const onKey = (event: KeyboardEvent) => {
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"));
    if (!typing && SCROLL_KEYS.has(event.key)) takeOver();
  };
  // A press on the content, a minimap mark or the scroll-to-end button moves
  // it on purpose; one in the composer doesn't.
  const onPress = (event: PointerEvent) => {
    const target = event.target;
    if (!(target instanceof Element) || (scrolls.foot && target.closest(scrolls.foot))) return;
    takeOver();
  };

  const onEnter = () => {
    hovered = true;
    measure();
    paint(true);
    light();
    show();
  };
  const onLeave = () => {
    hovered = false;
    light();
    show();
  };
  const onWheel = (event: WheelEvent) => {
    const target = find();
    if (!target) return;
    intend();
    forwardWheelToTimeline(event, target);
  };

  /** Where the pointer is on the track, from the track's top. */
  const along = (event: PointerEvent) => event.clientY - rail.getBoundingClientRect().top;

  const onDown = (event: PointerEvent) => {
    const target = find();
    if (event.button !== 0 || !target || !thumb) return;
    event.preventDefault();
    rail.setPointerCapture(event.pointerId);
    intend();
    // The page hears a press on a scroller's own bar as a press whose target
    // is the scroller: upstream's chat stops following a reply to its end
    // for it, as for a wheel, so the hand isn't pulled back down.
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        button: 0,
        buttons: 1,
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    );
    const at = along(event);
    const onThumb = at >= thumb.offset && at <= thumb.offset + thumb.length;
    drag = {
      pointer: event.pointerId,
      grab: onThumb ? at - thumb.offset : thumb.length / 2,
      from: at,
      moved: onThumb,
    };
    stopGlide();
    const share = shareAt(at - drag.grab, thumb.length, track);
    if (!onThumb && share !== null) glideTo(target, share);
    light();
    show();
  };
  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer || !scroller || !thumb) return;
    const at = along(event);
    if (!drag.moved && Math.abs(at - drag.from) < DRAG_SLOP) return;
    drag.moved = true;
    stopGlide();
    intend();
    scroller.scrollTop = scrollTopAt(at - drag.grab, thumb.length, scroller, track);
  };
  const onUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag = null;
    light();
    show();
  };

  box.addEventListener("scroll", onScroll, { capture: true, passive: true });
  box.addEventListener("wheel", takeOver, { capture: true, passive: true });
  box.addEventListener("touchmove", takeOver, { capture: true, passive: true });
  box.addEventListener("keydown", onKey, { capture: true });
  box.addEventListener("pointerdown", onPress, { capture: true });
  rail.addEventListener("pointerenter", onEnter);
  rail.addEventListener("pointerleave", onLeave);
  rail.addEventListener("wheel", onWheel, { passive: false });
  rail.addEventListener("pointerdown", onDown);
  rail.addEventListener("pointermove", onMove);
  rail.addEventListener("pointerup", onUp);
  rail.addEventListener("pointercancel", onUp);
  // The rail takes the pointer only while there is something to scroll, so
  // learn that once the scroller has laid out.
  const first = requestAnimationFrame(() => {
    measure();
    paint(false);
  });

  return () => {
    cancelAnimationFrame(first);
    stopGlide();
    window.clearTimeout(hideTimer);
    stopWatching();
    box.removeEventListener("scroll", onScroll, { capture: true });
    box.removeEventListener("wheel", takeOver, { capture: true });
    box.removeEventListener("touchmove", takeOver, { capture: true });
    box.removeEventListener("keydown", onKey, { capture: true });
    box.removeEventListener("pointerdown", onPress, { capture: true });
    rail.removeEventListener("pointerenter", onEnter);
    rail.removeEventListener("pointerleave", onLeave);
    rail.removeEventListener("wheel", onWheel);
    rail.removeEventListener("pointerdown", onDown);
    rail.removeEventListener("pointermove", onMove);
    rail.removeEventListener("pointerup", onUp);
    rail.removeEventListener("pointercancel", onUp);
  };
}
