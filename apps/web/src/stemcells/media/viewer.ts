/**
 * The viewer's hands: what opens it, steps it, zooms it and puts it away,
 * from keys, the trackpad and the pointer. `MediaViewer` renders the item
 * on stage; this decides where it goes and when, through `Stage`.
 */
import { LIFT_GAP, WheelContact } from "../tabs/swipe";
import { isContextMenuOpen, windowControlsOverlayHeight, type MediaItem } from "../upstream/media";
import {
  IN_VIEW,
  detailZoom,
  fit,
  mostZoom,
  pinchRange,
  pinchRelease,
  room,
  swipeStep,
  type Point,
  type Size,
} from "./geometry";
import { REPEAT_HOLD, REPEATS_HELD_AFTER_CLOSE, viewerKey } from "./keys";
import { itemKey, sameItem } from "./reel";
import { Stage, type Place } from "./stage";
import {
  drawn,
  emptySlot,
  focusTargetOf,
  naturalSize,
  shows,
  thumbnailOf,
  thumbnailPlace,
  type MediaElement,
  type ThumbnailScope,
} from "./thumbnails";

/** The size an item takes when it can't be shown: room for the words saying so. */
export const UNAVAILABLE_SIZE: Size = { width: 360, height: 200 };

/** A drag moves the picture only once it goes this far (px): less is a click. */
const DRAG_SLOP = 3;
/** The pointer's speed is read over this much of its trail (ms). */
const SPEED_WINDOW = 100;

export interface ViewerState {
  readonly items: readonly MediaItem[];
  readonly index: number;
  /** The current item's URL, once resolved. */
  readonly src: string | null;
  /** Where the items' thumbnails are. */
  readonly scope: ThumbnailScope;
}

export interface ViewerParts {
  readonly popup: HTMLElement;
  readonly figure: HTMLElement;
  readonly scrim: HTMLElement;
  readonly caption: HTMLElement;
}

interface Swipe {
  axis: "x" | "y" | null;
  travel: number;
  trail: { t: number; travel: number }[];
}

export class Viewer {
  #parts: ViewerParts | null = null;
  #stage: Stage | null = null;
  #state: ViewerState = { items: [], index: 0, src: null, scope: { root: null, within: null } };
  readonly #sizes = new Map<string, Size>();
  /** The clicked thumbnail, for the first flight only. */
  #source: MediaElement | null;
  readonly #opener: HTMLElement | null;
  #onStep: (item: MediaItem) => void = noop;
  #onClosed: () => void = noop;
  /** The item on stage, once its picture is placed; null while it loads. */
  #shown: MediaItem | null = null;
  /** How the next item to show arrives: lifted out of its thumbnail, or stepped to. */
  #arrival: { kind: "open" } | { kind: "step"; direction: -1 | 1 } = { kind: "open" };
  /** The thumbnail whose slot is empty while its picture is up, and what fills it again. */
  #slot: MediaElement | null = null;
  #restoreSlot: (() => void) | null = null;
  #landing: MediaElement | null = null;
  #closing = false;
  #closed = false;
  readonly #contact = new WheelContact();
  #swipe: Swipe | null = null;
  #wheelIdle = 0;
  #pinch: { scale: number } | null = null;
  #pinchIdle = 0;
  #drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  #dragged = false;

  constructor(options: { source: MediaElement | null; opener: HTMLElement | null }) {
    this.#source = options.source;
    this.#opener = options.opener;
  }

  /** What the viewer tells its view: it stepped to another item, or it has put its picture away. */
  listen(handlers: { onStep: (item: MediaItem) => void; onClosed: () => void }): void {
    this.#onStep = handlers.onStep;
    this.#onClosed = handlers.onClosed;
  }

  get #item(): MediaItem | undefined {
    return this.#state.items[this.#state.index];
  }

  get #key(): string | null {
    const item = this.#item;
    return item ? itemKey(item) : null;
  }

  /** The viewer has put its picture away (not merely been unmounted). */
  get closed(): boolean {
    return this.#closed;
  }

  attach(parts: ViewerParts): void {
    // Attached again to the same elements (React's development double mount),
    // the stage and the emptied slot carry on as they were.
    if (this.#stage === null || this.#parts?.figure !== parts.figure) {
      this.#stage = new Stage(parts);
    }
    this.#parts = parts;
    if (this.#slot && this.#restoreSlot === null) this.#restoreSlot = emptySlot(this.#slot);
    up.add(this);
    window.addEventListener("keydown", this.#onWindowKey, true);
    window.addEventListener("resize", this.#onResize);
    parts.popup.addEventListener("wheel", this.#onWheel, { passive: false });
    parts.popup.addEventListener("pointerdown", this.#onPointerDown);
    parts.popup.addEventListener("pointermove", this.#onPointerMove);
    parts.popup.addEventListener("pointerup", this.#onPointerUp);
    parts.popup.addEventListener("pointercancel", this.#onPointerUp);
    parts.popup.addEventListener("click", this.#onClick);
    parts.figure.addEventListener("dblclick", this.#onDoubleClick);
    // Neither bubbles; heard on the way down, from whatever the figure holds.
    parts.figure.addEventListener("load", this.#onMediaSize, true);
    parts.figure.addEventListener("loadedmetadata", this.#onMediaSize, true);
    parts.figure.addEventListener("error", this.#onMediaError, true);
  }

  detach(): void {
    const parts = this.#parts;
    up.delete(this);
    window.removeEventListener("keydown", this.#onWindowKey, true);
    window.removeEventListener("resize", this.#onResize);
    if (parts) {
      parts.popup.removeEventListener("wheel", this.#onWheel);
      parts.popup.removeEventListener("pointerdown", this.#onPointerDown);
      parts.popup.removeEventListener("pointermove", this.#onPointerMove);
      parts.popup.removeEventListener("pointerup", this.#onPointerUp);
      parts.popup.removeEventListener("pointercancel", this.#onPointerUp);
      parts.popup.removeEventListener("click", this.#onClick);
      parts.figure.removeEventListener("dblclick", this.#onDoubleClick);
      parts.figure.removeEventListener("load", this.#onMediaSize, true);
      parts.figure.removeEventListener("loadedmetadata", this.#onMediaSize, true);
      parts.figure.removeEventListener("error", this.#onMediaError, true);
    }
    clearTimeout(this.#wheelIdle);
    clearTimeout(this.#pinchIdle);
    // Whatever ends the viewer, the chat gets its thumbnail back.
    this.#restoreSlot?.();
    this.#restoreSlot = null;
  }

  /**
   * Where focus goes once the viewer is gone: the thumbnail it landed on,
   * else back where it was before the viewer opened, if that is still drawn.
   */
  focusAfterClose(): HTMLElement | null {
    const landed = focusTargetOf(this.#landing);
    if (landed) return landed;
    return this.#opener && drawn(this.#opener) ? this.#opener : null;
  }

  /** The item's size is known (a neighbour decoded ahead, or the server said). */
  measured(key: string, size: Size): void {
    if (size.width <= 0 || size.height <= 0) return;
    this.#sizes.set(key, size);
    if (this.#shown === null && key === this.#key && !this.#closing) this.#show();
  }

  /** After each render: the state on screen. Shows the current item once its size is known. */
  sync(state: ViewerState): void {
    this.#state = state;
    if (this.#closing) return;
    const item = this.#item;
    if (item === undefined) {
      this.close();
      return;
    }
    const shown = this.#shown;
    if (shown !== null && sameItem(shown, item)) {
      // The same item with a re-signed URL or a settled name: nothing on screen changes.
      const size = this.#sizes.get(itemKey(shown));
      if (size && !this.#sizes.has(itemKey(item))) this.#sizes.set(itemKey(item), size);
      this.#shown = item;
      return;
    }
    this.#show();
  }

  #show(): void {
    if (this.#closing) return;
    const stage = this.#stage;
    const item = this.#item;
    const key = this.#key;
    if (stage === null || item === undefined || key === null) return;
    const opening = this.#arrival.kind === "open";
    const source =
      opening && this.#source && shows(this.#source, item, this.#state.src)
        ? this.#source
        : thumbnailOf(this.#state.scope, item, this.#state.src);
    const size = this.#sizes.get(key) ?? (source ? naturalSize(source) : null);
    if (size === null) {
      this.#shown = null;
      stage.blank();
      return;
    }
    this.#sizes.set(key, size);
    const rest = fit(size, this.#room());
    stage.place(rest);
    this.#emptySlot(source);
    if (this.#arrival.kind === "step") {
      stage.stepIn(this.#arrival.direction);
    } else {
      const from: Place | null = thumbnailPlace(source, size, rest, IN_VIEW);
      stage.lift(from);
      this.#source = null;
    }
    this.#shown = item;
  }

  #room() {
    return room(viewport(), windowControlsOverlayHeight());
  }

  /** Steps to the neighbour that way, or leans when there is none. */
  step(direction: -1 | 1): void {
    const stage = this.#stage;
    if (stage === null || this.#closing) return;
    const next = this.#state.index + direction;
    const item = this.#state.items[next];
    if (item === undefined) {
      stage.lean(direction);
      return;
    }
    if (this.#shown !== null) stage.stepOut(direction);
    else stage.blank();
    this.#emptySlot(null);
    this.#arrival = { kind: "step", direction };
    this.#shown = null;
    this.#onStep(item);
  }

  /** Puts the picture away: home into the thumbnail of what is showing, or a fade where none shows. */
  close(): void {
    if (this.#closing) return;
    this.#closing = true;
    // A gesture still under way ends here: its release would turn the picture back mid-flight.
    clearTimeout(this.#wheelIdle);
    clearTimeout(this.#pinchIdle);
    this.#swipe = null;
    this.#pinch = null;
    const stage = this.#stage;
    const item = this.#item;
    const key = this.#key;
    const size = key === null ? undefined : this.#sizes.get(key);
    const rest = stage?.rest ?? null;
    const thumbnail =
      item && this.#shown !== null ? thumbnailOf(this.#state.scope, item, this.#state.src) : null;
    const to = thumbnail && size && rest ? thumbnailPlace(thumbnail, size, rest, IN_VIEW) : null;
    // Focus follows the picture home; with nowhere in view to land, it goes back to the opener.
    this.#landing = to ? thumbnail : null;
    holdRepeats();
    if (stage === null) {
      this.#finish();
      return;
    }
    stage.land(to, () => this.#finish());
  }

  #finish(): void {
    if (this.#closed) return;
    this.#closed = true;
    // The picture is in its slot: the slot fills, and the viewer goes, in one frame.
    this.#emptySlot(null);
    this.#onClosed();
  }

  /** Empties `thumbnail`'s slot (none: no slot is empty), filling the one emptied before. */
  #emptySlot(thumbnail: MediaElement | null): void {
    this.#restoreSlot?.();
    this.#slot = thumbnail;
    this.#restoreSlot = thumbnail ? emptySlot(thumbnail) : null;
  }

  #togglePlay(): void {
    const video = this.#parts?.figure.querySelector("video");
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }

  #zoomBy(factor: number, point?: Point): void {
    const stage = this.#stage;
    const rest = stage?.rest;
    const key = this.#key;
    const size = key === null ? undefined : this.#sizes.get(key);
    if (!stage || !rest || !size) return;
    const most = mostZoom(size, rest);
    stage.zoomTo(Math.min(most, Math.max(1, stage.pose.scale * factor)), viewport(), point);
  }

  #toggleZoom(point?: Point): void {
    const stage = this.#stage;
    const rest = stage?.rest;
    const key = this.#key;
    const size = key === null ? undefined : this.#sizes.get(key);
    if (!stage || !rest || !size) return;
    stage.zoomTo(stage.zoomed ? 1 : detailZoom(size, rest), viewport(), point);
  }

  readonly #onWindowKey = (event: KeyboardEvent): void => {
    viewerHearsFirst(event);
  };

  /** A key, heard before anything else in the app. */
  hear(event: KeyboardEvent): void {
    // An open context menu over the picture has the keys.
    if (isContextMenuOpen() || this.#parts === null) return;
    const showing = this.#item?.type === "video" ? "video" : "image";
    const target = event.target;
    const action = viewerKey(
      {
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        onControl: target instanceof HTMLButtonElement && this.#parts.popup.contains(target),
      },
      showing,
    );
    if (action === "pass") return;
    // Nothing behind the viewer hears it: not the chat, not the app's shortcuts.
    event.stopImmediatePropagation();
    if (action === "system") return;
    event.preventDefault();
    // While the picture lands, keys stop here and do nothing more.
    if (this.#closing || (event.repeat && action === "close")) return;
    switch (action) {
      case "close":
        this.close();
        return;
      case "previous":
        this.step(-1);
        return;
      case "next":
        this.step(1);
        return;
      case "play":
        this.#togglePlay();
        return;
      case "zoom-in":
        this.#zoomBy(1.5);
        return;
      case "zoom-out":
        this.#zoomBy(1 / 1.5);
        return;
      case "zoom-fit":
        this.#stage?.zoomTo(1, viewport());
        return;
      case "zoom-toggle":
        this.#toggleZoom();
        return;
      default:
        return;
    }
  }

  readonly #onResize = (): void => {
    const key = this.#key;
    const size = key === null ? undefined : this.#sizes.get(key);
    if (this.#closing || !size || this.#shown === null) return;
    this.#stage?.place(fit(size, this.#room()));
    this.#stage?.showCaption(0);
  };

  readonly #onMediaSize = (event: Event): void => {
    const target = event.target;
    const key = this.#key;
    if (key === null) return;
    if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
      const size = naturalSize(target);
      if (size) this.measured(key, size);
    }
  };

  /** A picture or video that won't load still takes the stage, to say so. */
  readonly #onMediaError = (): void => {
    const key = this.#key;
    if (key !== null && !this.#sizes.has(key)) this.measured(key, UNAVAILABLE_SIZE);
  };

  readonly #onWheel = (event: WheelEvent): void => {
    // The viewer owns every wheel over it: nothing behind scrolls or turns.
    event.preventDefault();
    const stage = this.#stage;
    if (stage === null || stage.rest === null || this.#closing) return;
    if (event.ctrlKey) {
      this.#onPinch(event);
      return;
    }
    if (stage.zoomed) {
      stage.panBy(-event.deltaX, -event.deltaY, viewport(), true);
      return;
    }
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return;
    const sample = { dx: event.deltaX, dy: event.deltaY, t: event.timeStamp };
    const contact = this.#contact.wheel(sample);
    clearTimeout(this.#wheelIdle);
    this.#wheelIdle = window.setTimeout(this.#onWheelIdle, LIFT_GAP + 10);
    if (contact.phase === "began") {
      this.#releaseSwipe(sample.t);
      this.#swipe = { axis: null, travel: 0, trail: [] };
    }
    if (contact.phase === "began" || contact.phase === "moved") this.#moveSwipe(sample);
    if (contact.phase === "lifted") this.#releaseSwipe(sample.t);
  };

  readonly #onWheelIdle = (): void => {
    if (this.#contact.idle(performance.now())) this.#releaseSwipe(performance.now());
  };

  #moveSwipe(sample: { dx: number; dy: number; t: number }): void {
    const swipe = this.#swipe;
    const stage = this.#stage;
    if (swipe === null || stage === null || this.#closing) return;
    if (swipe.axis === null) {
      if (Math.abs(sample.dx) + Math.abs(sample.dy) <= 0.5) return;
      swipe.axis = Math.abs(sample.dx) > Math.abs(sample.dy) ? "x" : "y";
    }
    if (swipe.axis !== "x") return;
    swipe.travel -= sample.dx;
    swipe.trail.push({ t: sample.t, travel: swipe.travel });
    while (swipe.trail.length > 2 && swipe.trail[0]!.t < sample.t - SPEED_WINDOW) {
      swipe.trail.shift();
    }
    const toward = swipe.travel < 0 ? 1 : -1;
    const open = this.#state.items[this.#state.index + toward] !== undefined;
    stage.swipeTo(swipe.travel, open, viewport());
  }

  #releaseSwipe(now: number): void {
    const swipe = this.#swipe;
    this.#swipe = null;
    const stage = this.#stage;
    if (swipe === null || swipe.axis !== "x" || stage === null || swipe.travel === 0) return;
    if (this.#closing) return;
    const first = swipe.trail[0];
    const last = swipe.trail.at(-1);
    const velocity =
      first && last && last.t > first.t && now - last.t <= SPEED_WINDOW
        ? ((last.travel - first.travel) / (last.t - first.t)) * 1000
        : 0;
    const direction = swipeStep(swipe.travel, velocity);
    if (direction !== 0 && this.#state.items[this.#state.index + direction] !== undefined) {
      this.step(direction);
    } else {
      stage.swipeBack();
    }
  }

  #onPinch(event: WheelEvent): void {
    const stage = this.#stage;
    const rest = stage?.rest;
    const key = this.#key;
    const size = key === null ? undefined : this.#sizes.get(key);
    if (!stage || !rest || !size) return;
    const most = mostZoom(size, rest);
    const range = pinchRange(most);
    const scale = Math.min(
      range.most,
      Math.max(range.least, stage.pose.scale * Math.exp(-event.deltaY * 0.01)),
    );
    this.#pinch = { scale };
    stage.pinch(scale, { x: event.clientX, y: event.clientY });
    clearTimeout(this.#pinchIdle);
    this.#pinchIdle = window.setTimeout(() => this.#releasePinch(most), LIFT_GAP + 10);
  }

  #releasePinch(most: number): void {
    const pinch = this.#pinch;
    this.#pinch = null;
    const stage = this.#stage;
    if (pinch === null || stage === null || this.#closing) return;
    switch (pinchRelease(pinch.scale, most)) {
      case "close":
        this.close();
        return;
      case "rest":
        stage.settlePinch(1, viewport());
        return;
      case "most":
        stage.settlePinch(most, viewport());
        return;
      default:
        stage.settlePinch(pinch.scale, viewport());
    }
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    const parts = this.#parts;
    const stage = this.#stage;
    this.#dragged = false;
    if (!parts || !stage || this.#closing || event.button !== 0) return;
    if (!stage.zoomed || !(event.target instanceof Node) || !parts.figure.contains(event.target)) {
      return;
    }
    this.#drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    parts.popup.setPointerCapture(event.pointerId);
    parts.popup.dataset.dragging = "";
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag === null || drag.id !== event.pointerId || this.#closing) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    this.#stage?.panBy(dx, dy, viewport(), false);
  };

  readonly #onPointerUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    if (drag === null || drag.id !== event.pointerId) return;
    this.#drag = null;
    this.#dragged = drag.moved;
    delete this.#parts?.popup.dataset.dragging;
    if (drag.moved && !this.#closing) this.#stage?.settlePan(viewport());
  };

  readonly #onClick = (event: MouseEvent): void => {
    const parts = this.#parts;
    if (parts === null || this.#dragged) {
      this.#dragged = false;
      return;
    }
    const target = event.target;
    if (!(target instanceof Node) || parts.figure.contains(target)) return;
    if (target instanceof Element && target.closest("button")) return;
    this.close();
  };

  readonly #onDoubleClick = (event: MouseEvent): void => {
    if (this.#item?.type === "video" || this.#closing) return;
    event.preventDefault();
    this.#toggleZoom({ x: event.clientX, y: event.clientY });
  };
}

function noop(): void {}

function viewport(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The viewers up now: one at a time, as each takes the whole window. */
const up = new Set<Viewer>();
/** Until when a held key's repeats stay the viewer's after it closes (`performance.now()`). */
let repeatsHeldUntil = 0;
const heard = new WeakSet<Event>();

/**
 * Hands a key to the viewer before the rest of the app hears it. The
 * workspace's key listener, the window's first, calls this before anything
 * else (`tabs/useWorkspaceKeys.ts`); the viewer's own listener calls it too,
 * for a chat outside the workspace. Each key is heard once. True while the
 * key is the viewer's to say (it is up, or the key repeats one that closed
 * it): whoever called stands down.
 */
export function viewerHearsFirst(event: KeyboardEvent): boolean {
  const viewer = [...up].at(-1);
  const held =
    viewer === undefined &&
    event.repeat &&
    REPEATS_HELD_AFTER_CLOSE.has(event.key) &&
    performance.now() < repeatsHeldUntil;
  if (!heard.has(event)) {
    heard.add(event);
    if (viewer) viewer.hear(event);
    else if (held) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  return viewer !== undefined || held;
}

/**
 * For a moment after the viewer closes, a held key's repeats stop here: an
 * Esc held to close it must not go on to stop a Cell, nor a held arrow scroll
 * the chat.
 */
function holdRepeats(): void {
  repeatsHeldUntil = performance.now() + REPEAT_HOLD;
  const onKey = (event: KeyboardEvent) => {
    viewerHearsFirst(event);
  };
  window.addEventListener("keydown", onKey, true);
  window.setTimeout(() => window.removeEventListener("keydown", onKey, true), REPEAT_HOLD);
}
