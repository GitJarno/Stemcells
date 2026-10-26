/**
 * A surface flies between its card and the workbench. Every way in or out goes through
 * upstream's floater store, so flights are read there once; it tells of a change before React
 * draws it, so the start is still on screen to measure. A stand-in flies (the live page can't:
 * a desktop browser is drawn at the app's root), and the page fades in where it lands.
 */
import { motionTiming, reducedMotion } from "../tokens/motion";
import {
  browserViewOf,
  panelShowsFloater,
  sameFloater,
  subscribeToFloaters,
  type FloaterSource,
} from "../upstream/floater";

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** A card's corner (upstream's floater's, and the tucked card's). */
const CARD_CORNER = 12;
/** How many frames a landing waits for its card to be laid out. */
const LAYOUT_FRAMES = 6;

/** Watches the floaters for surfaces coming out of their cards and going back; returns the stop. */
export function watchFlights(): () => void {
  return subscribeToFloaters((next, previous) => {
    if (reducedMotion()) return;
    for (const [key, floater] of Object.entries(next)) {
      const before = previous[key];
      if (before !== undefined && sameFloater(before.source, floater.source)) continue;
      // Upstream floats a surface just before it closes the panel showing it.
      if (panelShowsFloater(key, floater.source)) land(key, floater.source);
    }
    for (const [key, floater] of Object.entries(previous)) {
      if (next[key] === undefined) open(key, floater.source);
    }
  });
}

/** The card grows into the workbench, if the panel opens on it; × only ends it. */
function open(threadKey: string, source: FloaterSource) {
  const card = cardBox(threadKey);
  if (card === null) return;
  const flight = new Flight(threadKey, card.box, CARD_CORNER);
  flight.afterLayout(() => {
    // Ended by its × or by an agent: no panel takes it, so nothing flies.
    if (!panelShowsFloater(threadKey, source)) return "abort";
    flight.hide(source, "opening");
    const bench = workbenchBox(threadKey);
    if (bench === null) return "wait";
    flight.to(bench, 0, "lift");
    return "flying";
  });
}

/** The workbench shrinks back into the card, beside the chat or tucked. */
function land(threadKey: string, source: FloaterSource) {
  const bench = workbenchBox(threadKey);
  if (bench === null) return;
  const flight = new Flight(threadKey, bench, 0);
  flight.hide(source, "landing");
  flight.afterLayout(() => {
    const card = cardBox(threadKey);
    if (card === null) return "wait";
    flight.to(card.box, CARD_CORNER, "land");
    return "flying";
  });
}

/** Each thread's flight under way: a newer one ends it where it is. */
const underway = new Map<string, Flight>();

/**
 * The stand-in: the card's ground, fixed over the window, cut to where the
 * surface is. It hides where the surface is going until it gets there, and
 * shows it again however the flight ends.
 */
class Flight {
  readonly #threadKey: string;
  readonly #element: HTMLDivElement;
  #box: Box;
  #corner: number;
  #reveal: (() => void) | null = null;
  #ended = false;

  constructor(threadKey: string, box: Box, corner: number) {
    underway.get(threadKey)?.end();
    underway.set(threadKey, this);
    this.#threadKey = threadKey;
    this.#box = box;
    this.#corner = corner;
    this.#element = document.createElement("div");
    this.#element.setAttribute("data-stemcells-flight", "");
    this.#element.setAttribute("aria-hidden", "true");
    this.#place(box);
    this.#element.style.clipPath = cut(box, box, corner);
    document.body.append(this.#element);
  }

  /** Hides where the surface is going until the flight hands it over (`hideWhileFlying`). */
  hide(source: FloaterSource, way: "opening" | "landing") {
    this.#reveal ??= hideWhileFlying(this.#threadKey, source, way);
  }

  /**
   * Runs `step` once React has drawn the change, and again each frame while
   * it waits for layout, up to a few frames; gives up on `abort`.
   */
  afterLayout(step: () => "flying" | "wait" | "abort") {
    let frames = 0;
    const tick = () => {
      if (this.#ended) return;
      const outcome = step();
      if (outcome === "flying") return;
      frames += 1;
      if (outcome === "abort" || frames >= LAYOUT_FRAMES) this.end();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /**
   * Flies to `box`, its corner becoming `corner`, on a motion token, and
   * hands over a fade before it settles: a spring's last stretch is pixels
   * long, so the surface fades in over it rather than after it.
   */
  to(box: Box, corner: number, motion: "lift" | "land") {
    const room = union(this.#box, box);
    this.#place(room);
    const from = cut(room, this.#box, this.#corner);
    const to = cut(room, box, corner);
    this.#element.style.clipPath = to;
    this.#box = box;
    this.#corner = corner;
    const { duration, easing } = motionTiming(motion);
    this.#element.animate({ clipPath: [from, to] }, { duration, easing });
    const fade = motionTiming("fade");
    setTimeout(
      () => {
        if (this.#ended) return;
        this.#finish();
        void this.#element
          .animate({ opacity: [1, 0] }, { ...fade, fill: "forwards" })
          .finished.catch(() => undefined)
          .then(() => this.#element.remove());
      },
      Math.max(0, duration - fade.duration),
    );
  }

  /** Ends the flight where it is: the surface shows where it went, at once. */
  end() {
    if (this.#ended) return;
    this.#finish();
    this.#element.remove();
  }

  #finish() {
    this.#ended = true;
    if (underway.get(this.#threadKey) === this) underway.delete(this.#threadKey);
    this.#reveal?.();
  }

  #place(box: Box) {
    Object.assign(this.#element.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
    });
  }
}

/**
 * Hides where the surface is going until the stand-in gets there: the
 * workbench while a card opens (its panel's own width animation off, so it
 * lays out at once where the flight ends), the card while it lands, and the
 * desktop browser's page either way. Returns the reveal, a fade.
 */
function hideWhileFlying(threadKey: string, source: FloaterSource, way: "opening" | "landing") {
  const root = document.documentElement;
  root.setAttribute("data-stemcells-flying", way);
  const hidden = new Set<HTMLElement>();
  let shown = false;
  const hide = () => {
    if (shown) return;
    const view = browserViewOf(threadKey, source);
    if (view !== null && !hidden.has(view)) {
      view.style.opacity = "0";
      hidden.add(view);
    }
    if (way === "landing") {
      for (const card of floaters(threadKey)) {
        card.style.opacity = "0";
        hidden.add(card);
      }
    }
  };
  hide();
  // The page and the card are drawn by the next layout: hide them there too.
  requestAnimationFrame(hide);
  return () => {
    shown = true;
    root.removeAttribute("data-stemcells-flying");
    for (const element of [...hidden, ...(way === "opening" ? workbenches(threadKey) : [])]) {
      element.style.opacity = "";
      fadeIn(element);
    }
  };
}

function fadeIn(element: HTMLElement) {
  const { duration, easing } = motionTiming("fade");
  element.animate({ opacity: [0, 1] }, { duration, easing });
}

/** A clip of `room` to `box`, with rounded corners. */
function cut(room: Box, box: Box, corner: number): string {
  const inset = [
    box.top - room.top,
    room.right - box.right,
    room.bottom - box.bottom,
    box.left - room.left,
  ];
  return `inset(${inset.map((side) => `${side}px`).join(" ")} round ${corner}px)`;
}

function union(a: Box, b: Box): Box {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

function intersect(a: Box, b: Box): Box | null {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : null;
}

const viewport = (): Box => ({
  left: 0,
  top: 0,
  right: window.innerWidth,
  bottom: window.innerHeight,
});

/** The thread's floaters drawn now (a chat may show in two places). */
function floaters(threadKey: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      `[data-stemcells-floater="${CSS.escape(threadKey)}"]`,
    ),
  ];
}

/**
 * Where the thread's card shows on screen: upstream's floater beside the
 * chat, or the part of the tucked card in front of the chat's edge.
 */
function cardBox(threadKey: string): { readonly box: Box } | null {
  for (const floater of floaters(threadKey)) {
    const room = intersect(floater.getBoundingClientRect(), viewport());
    const card = floater.querySelector("[data-preview-mini-player], [data-stemcells-tuck-card]");
    if (room === null || card === null) continue;
    const box = intersect(card.getBoundingClientRect(), room);
    if (box !== null) return { box };
  }
  return null;
}

/** The workbenches holding the thread's surfaces now. */
function workbenches(threadKey: string): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      `[data-stemcells-panel-of="${CSS.escape(threadKey)}"]`,
    ),
  ].flatMap((panel) => panel.parentElement ?? []);
}

/** Where the workbench holding the thread's surfaces shows on screen. */
function workbenchBox(threadKey: string): Box | null {
  for (const workbench of workbenches(threadKey)) {
    const box = intersect(workbench.getBoundingClientRect(), viewport());
    if (box !== null) return box;
  }
  return null;
}
