/**
 * The chat's thumbnails on the page: which one a click came from, which one
 * an item flies home to, where on screen each draws its picture, and its
 * slot, emptied while its picture is up in the viewer.
 */
import { registeredMediaItem, type MediaItem } from "../upstream/media";
import {
  IN_VIEW,
  drawnRect,
  intersect,
  onThumbnail,
  visibleShare,
  type Rect,
  type Size,
} from "./geometry";
import { itemNames, sameItem } from "./reel";
import type { Place } from "./stage";

export type MediaElement = HTMLImageElement | HTMLVideoElement;

function isMedia(element: Element | null): element is MediaElement {
  return element instanceof HTMLImageElement || element instanceof HTMLVideoElement;
}

/** How far up from what was pressed a lone picture still counts as the one it opened. */
const PRESS_REACH = 4;

/**
 * The picture a click or a key press on `from` opened: the element itself,
 * or the one picture inside the nearest of its ancestors that holds just one
 * (a button around a picture; a video under its play button, pressed on the
 * button's icon).
 */
export function pressedMedia(from: Element | null): MediaElement | null {
  let node = from;
  for (let depth = 0; node && depth <= PRESS_REACH; depth += 1, node = node.parentElement) {
    if (isMedia(node)) return node;
    const inside = node.querySelectorAll("img, video");
    if (inside.length === 1 && isMedia(inside[0] ?? null)) return inside[0] as MediaElement;
    if (inside.length > 1) return null;
  }
  return null;
}

/** Whether `element` shows `item` (whose resolved URL is `src`). */
export function shows(element: MediaElement, item: MediaItem, src: string | null): boolean {
  const registered = registeredMediaItem(element);
  if (registered && sameItem(registered, item)) return true;
  const names = new Set(itemNames(item, src));
  const own = [element.getAttribute("src"), element.currentSrc].filter(
    (value): value is string => !!value,
  );
  return own.some((value) => names.has(`src:${value}`));
}

/**
 * Where an item's thumbnails are looked for: the chat's view, and within it
 * only what matches `within` when it says (the timeline's rows, for the
 * chat's own reel: not the composer, not the side panel).
 */
export interface ThumbnailScope {
  readonly root: ParentNode | null;
  readonly within: string | null;
}

/**
 * The first thumbnail of `item` in `scope` a person sees now (most of it in
 * view), or null when none is: an item never flies to, or gives focus to, a
 * thumbnail scrolled away.
 */
export function thumbnailOf(
  scope: ThumbnailScope,
  item: MediaItem,
  src: string | null,
): MediaElement | null {
  if (scope.root === null) return null;
  for (const element of scope.root.querySelectorAll<MediaElement>("img, video")) {
    if (scope.within && !element.closest(scope.within)) continue;
    if (shows(element, item, src) && drawn(element) && shareInView(element) >= IN_VIEW) {
      return element;
    }
  }
  return null;
}

function shareInView(element: Element): number {
  const box = rectOf(element.getBoundingClientRect());
  return visibleShare(box, [...clippingRects(element), viewportRect()]);
}

/** Whether the element draws at all: laid out and visible. */
export function drawn(element: Element): boolean {
  if (!element.isConnected || element.getClientRects().length === 0) return false;
  return getComputedStyle(element).visibility !== "hidden";
}

/** The picture's own pixel size, once the element knows it. */
export function naturalSize(element: MediaElement): Size | null {
  const size =
    element instanceof HTMLImageElement
      ? { width: element.naturalWidth, height: element.naturalHeight }
      : { width: element.videoWidth, height: element.videoHeight };
  return size.width > 0 && size.height > 0 ? size : null;
}

/**
 * Where a thumbnail sits for a flight: the pose and crop that lay a picture
 * resting at `rest` over it. Null when less than `share` of it shows (it is
 * scrolled away, clipped, on another tab) or it isn't drawn: then there is
 * nowhere true to fly.
 */
export function thumbnailPlace(
  element: MediaElement | null,
  natural: Size,
  rest: Rect,
  share: number,
): Place | null {
  if (element === null || !drawn(element)) return null;
  const box = rectOf(element.getBoundingClientRect());
  const style = getComputedStyle(element);
  const picture = drawnRect(box, natural, style.objectFit);
  const clips = [box, ...clippingRects(element), viewportRect()];
  if (visibleShare(box, clips) < share) return null;
  let shown: Rect | null = picture;
  for (const clip of clips) shown = shown && intersect(shown, clip);
  if (shown === null) return null;
  return onThumbnail(rest, picture, shown, cornerOf(element, box));
}

function rectOf(rect: DOMRectReadOnly): Rect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function viewportRect(): Rect {
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
}

/** The boxes of the element's ancestors that clip it: scrollers, and anything that hides its overflow. */
function clippingRects(element: Element): Rect[] {
  const rects: Rect[] = [];
  for (
    let node = element.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflowY !== "visible") {
      rects.push(rectOf(node.getBoundingClientRect()));
    }
  }
  return rects;
}

/** The thumbnail's corner: its own, or a clipping frame's around it (a rounded tile hiding its overflow). */
function cornerOf(element: Element, box: Rect): number {
  let node: Element | null = element;
  for (let depth = 0; node && depth < 3; depth += 1, node = node.parentElement) {
    const style = getComputedStyle(node);
    const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
    if (radius > 0 && (node === element || style.overflowX !== "visible")) {
      const frame = node.getBoundingClientRect();
      // A frame much larger than the picture rounds something else.
      if (frame.width <= box.width + 4 && frame.height <= box.height + 4) return radius;
    }
  }
  return 0;
}

/**
 * Empties a thumbnail's slot while its picture is up: the picture, and a
 * play button laid over a video. Returns what puts it back.
 */
export function emptySlot(element: MediaElement): () => void {
  const parts: HTMLElement[] = [element];
  if (element instanceof HTMLVideoElement) {
    for (const sibling of element.parentElement?.children ?? []) {
      if (sibling instanceof HTMLButtonElement) parts.push(sibling);
    }
  }
  // Opacity, not visibility: the slot stays a place to fly home to.
  const before = parts.map((part) => part.style.opacity);
  parts.forEach((part) => {
    part.style.opacity = "0";
  });
  return () => {
    parts.forEach((part, index) => {
      part.style.opacity = before[index] ?? "";
    });
  };
}

/**
 * Where focus goes back to: the control that opens the thumbnail (its
 * button, or a play button laid over a video), else whatever around it takes
 * focus; never one that isn't drawn.
 */
export function focusTargetOf(element: MediaElement | null): HTMLElement | null {
  if (element === null || !element.isConnected) return null;
  const target =
    element.closest<HTMLElement>('button, a[href], [role="button"]') ??
    element.parentElement?.querySelector<HTMLElement>(":scope > button") ??
    element.closest<HTMLElement>("[tabindex]");
  return target && drawn(target) ? target : null;
}
