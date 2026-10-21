/**
 * A native surface rides the page it sits on.
 *
 * The desktop browser is a view fixed over the app, at the rect its slot
 * last presented (`upstream/surfaces.ts`). Upstream presents again when the
 * slot resizes; a page sliding moves its slot without resizing it, so the
 * view stayed where the page had been, and the page slid away from it. While
 * the pages move (`data-moving` on `[data-stemcells-pages]`, the pager's),
 * the view follows its slot, moved by a transform and its content cut to the
 * pages' frame: nothing for React to render, nothing for the guest to paint
 * again (it paints on a resize; a move is the compositor's). When the pages
 * rest, the slot presents where it is and the transform goes.
 *
 * The fingers move the pages from the main thread, frame by frame, and the
 * view follows each frame there. A slide runs on the compositor, on through
 * a main thread busy with the turn it sets off, so the view gets copies of
 * it: the same timing and start, moving the view and cutting its content as
 * the slide moves the slot.
 *
 * The move and the cut are on two boxes: the compositor draws a cut on the
 * box it moves from the main thread, so a busy main thread left the cut
 * behind the move, and the page showed past the pages' edge.
 */

/** A shown view, and the point upstream placed it at. */
export interface PlacedView {
  /** The view, fixed over the app: it is moved. */
  readonly element: HTMLElement;
  /** The box inside it at its top-left, holding the page: it is cut. */
  readonly content: HTMLElement;
  readonly x: number;
  readonly y: number;
}

export interface Rider {
  /** The slot: the box the view is placed over. */
  readonly anchor: HTMLElement;
  /** The view, while it is shown; null while it isn't. */
  readonly view: () => PlacedView | null;
  /** The pages rest: the slot presents again, where it is now. */
  readonly rest: () => void;
}

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Rides the view with its slot's page while the pages move; returns the stop. */
export function ride(rider: Rider): () => void {
  const pages = rider.anchor.closest<HTMLElement>("[data-stemcells-pages]");
  if (pages === null) return () => undefined;
  /** The view we move and cut, by inline style or by copies of a slide. */
  let held: PlacedView | null = null;
  /** The slide the view has copies of, the copies, and where the view was placed for them. */
  let mirrored: { slide: Animation; copies: Animation[]; placed: PlacedView } | null = null;
  let frame = 0;

  const unmirror = () => {
    for (const copy of mirrored?.copies ?? []) copy.cancel();
    mirrored = null;
  };
  const letGo = () => {
    unmirror();
    if (held === null) return;
    held.element.style.transform = "";
    held.content.style.clipPath = "";
    held = null;
  };
  const show = (view: PlacedView, look: Look) => {
    const { element, content } = view;
    if (element.style.transform !== look.transform) element.style.transform = look.transform;
    if (content.style.clipPath !== look.clipPath) content.style.clipPath = look.clipPath;
  };

  const follow = () => {
    const placed = rider.view();
    if (placed?.element !== held?.element || placed?.content !== held?.content) letGo();
    if (placed === null) return;
    held = placed;
    const slide = slideOf(rider.anchor, pages);
    if (
      slide !== null &&
      mirrored?.slide === slide &&
      mirrored.placed.x === placed.x &&
      mirrored.placed.y === placed.y
    ) {
      return;
    }
    unmirror();
    const at = rider.anchor.getBoundingClientRect();
    const size = { width: placed.content.offsetWidth, height: placed.content.offsetHeight };
    const bounds = pages.getBoundingClientRect();
    const copies = slide === null ? null : mirror(slide, at, size, placed, bounds);
    if (slide !== null && copies !== null) {
      mirrored = { slide, copies: copies.animations, placed };
      // Where the slide ends: the view stays there once it and its copies are done.
      show(placed, copies.end);
    } else {
      show(placed, lookAt({ x: at.x - placed.x, y: at.y - placed.y }, at, size, bounds));
    }
  };

  const loop = () => {
    frame = requestAnimationFrame(loop);
    follow();
  };
  // A finger's stroke is written to the strip in the pager's own frame
  // callback, which may run after ours: following each write as it lands
  // keeps the view on the frame the page is drawn in.
  const strokes = new MutationObserver(follow);
  const watch = () => {
    if (pages.hasAttribute("data-moving")) {
      if (frame !== 0) return;
      strokes.observe(pages, { attributes: true, attributeFilter: ["style"], subtree: true });
      loop();
    } else if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
      strokes.disconnect();
      unmirror();
      rider.rest();
      follow();
    }
  };
  const moving = new MutationObserver(watch);
  moving.observe(pages, { attributes: true, attributeFilter: ["data-moving"] });
  watch();

  return () => {
    moving.disconnect();
    strokes.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    letGo();
  };
}

/** The running animation that moves the slot with an ancestor inside the pages, if one does. */
function slideOf(anchor: HTMLElement, pages: HTMLElement): Animation | null {
  for (let element = anchor.parentElement; element !== null; element = element.parentElement) {
    for (const animation of element.getAnimations()) {
      if (animation.playState !== "running" || !(animation.effect instanceof KeyframeEffect)) {
        continue;
      }
      if (animation.effect.getKeyframes().some((key) => key.transform || key.opacity)) {
        return animation;
      }
    }
    if (element === pages) break;
  }
  return null;
}

/** The view's move and its content's cut, as inline style or a keyframe writes them. */
interface Look {
  readonly transform: string;
  readonly clipPath: string;
}

/**
 * The view moved by `by`, its slot at `at` once moved, its content of `size`
 * cut to `bounds`. The cut is in percent of the content's box: a composited
 * animation of a cut in pixels draws half of it on a 2x display (Electron 44).
 */
export function lookAt(by: Point, at: Box, size: Size, bounds: Box): Look {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const top = Math.max(0, bounds.top - at.top);
  const right = Math.max(0, at.left + width - bounds.right);
  const bottom = Math.max(0, at.top + height - bounds.bottom);
  const left = Math.max(0, bounds.left - at.left);
  const still = Math.abs(by.x) < 0.5 && Math.abs(by.y) < 0.5;
  const whole = top + right + bottom + left < 0.5;
  const percent = (part: number, of: number) => `${Number(((part / of) * 100).toFixed(3))}%`;
  return {
    transform: still ? "" : `translate3d(${by.x}px, ${by.y}px, 0)`,
    clipPath: whole
      ? ""
      : `inset(${percent(top, height)} ${percent(right, width)} ${percent(bottom, height)} ${percent(left, width)})`,
  };
}

/** A keyframe's transform as a move in pixels on `box`; null for anything else. */
export function translation(transform: string | null | undefined, box: Size): Point | null {
  const value = transform?.trim() ?? "";
  if (value === "" || value === "none") return { x: 0, y: 0 };
  const match = /^translate(3d|X|Y)?\(([^)]*)\)$/.exec(value);
  if (match === null) return null;
  const parts = (match[2] ?? "").split(",").map((part) => part.trim());
  const length = (part: string | undefined, of: number): number | null => {
    if (part === undefined) return 0;
    const number = /^(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(px|%)?$/.exec(part);
    if (number === null) return null;
    const amount = Number(number[1]);
    if (number[2] === "%") return (amount / 100) * of;
    return number[2] === "px" || amount === 0 ? amount : null;
  };
  const axis = match[1];
  const x = axis === "Y" ? 0 : length(parts[0], box.width);
  const y =
    axis === "Y" ? length(parts[0], box.height) : axis === "X" ? 0 : length(parts[1], box.height);
  return x === null || y === null ? null : { x, y };
}

/** One keyframe of a slide, as `getKeyframes()` gives it. */
export interface SlideKey {
  readonly offset: number;
  readonly transform: Point;
  readonly opacity?: string | number | undefined;
}

/** A key of the copies: the view's move, its content's cut, and the slide's fade. */
export interface MirroredKey extends Look {
  readonly offset: number;
  readonly opacity?: string | number | undefined;
}

/**
 * The view's keys for a slide whose keys move its target as given: the view
 * moves as the slot does, and its content's cut changes with it. Where a
 * slot's edge crosses the pages' edge between two keys, a key of its own
 * keeps the cut exact there.
 */
export function mirroredKeys(
  keys: readonly SlideKey[],
  slot: Box,
  size: Size,
  now: Point,
  placed: Point,
  bounds: Box,
): MirroredKey[] {
  const at = (key: SlideKey): Box => {
    const dx = key.transform.x - now.x;
    const dy = key.transform.y - now.y;
    return {
      left: slot.left + dx,
      top: slot.top + dy,
      right: slot.left + dx + size.width,
      bottom: slot.top + dy + size.height,
    };
  };
  const keyAt = (offset: number, box: Box, opacity: SlideKey["opacity"]): MirroredKey => {
    const look = lookAt({ x: box.left - placed.x, y: box.top - placed.y }, box, size, bounds);
    return {
      offset,
      transform: look.transform || "none",
      clipPath: look.clipPath || "inset(0%)",
      ...(opacity === undefined ? {} : { opacity }),
    };
  };
  const mirrored: MirroredKey[] = [];
  keys.forEach((key, index) => {
    const box = at(key);
    mirrored.push(keyAt(key.offset, box, key.opacity));
    const next = keys[index + 1];
    if (next === undefined) return;
    const to = at(next);
    const crossings: number[] = [];
    for (const [from, until, edge] of [
      [box.left, to.left, bounds.left],
      [box.right, to.right, bounds.right],
      [box.top, to.top, bounds.top],
      [box.bottom, to.bottom, bounds.bottom],
    ] as const) {
      const share = (edge - from) / (until - from);
      if (share > 1e-6 && share < 1 - 1e-6) crossings.push(share);
    }
    for (const share of crossings.sort((a, b) => a - b)) {
      const between: Box = {
        left: box.left + (to.left - box.left) * share,
        top: box.top + (to.top - box.top) * share,
        right: box.right + (to.right - box.right) * share,
        bottom: box.bottom + (to.bottom - box.bottom) * share,
      };
      mirrored.push(keyAt(key.offset + (next.offset - key.offset) * share, between, undefined));
    }
  });
  return mirrored;
}

/** Copies of `slide` on the view and its content, started with it; null when the slide can't be copied. */
function mirror(
  slide: Animation,
  slot: DOMRect,
  size: Size,
  placed: PlacedView,
  bounds: DOMRect,
): { animations: Animation[]; end: Look } | null {
  const effect = slide.effect;
  if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof HTMLElement)) return null;
  const target = effect.target;
  const box = { width: target.offsetWidth, height: target.offsetHeight };
  const keys: SlideKey[] = [];
  for (const key of effect.getKeyframes()) {
    // Between keys the view must move as the slot does: in a straight line.
    if (key.easing !== undefined && key.easing !== "linear") return null;
    const move = translation(key.transform as string | undefined, box);
    if (move === null) return null;
    keys.push({ offset: key.computedOffset, transform: move, opacity: key.opacity ?? undefined });
  }
  const computed = getComputedStyle(target).transform;
  const matrix = computed === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(computed);
  const mirrored = mirroredKeys(keys, slot, size, { x: matrix.m41, y: matrix.m42 }, placed, bounds);
  const timing = effect.getTiming();
  const animations = [
    placed.element.animate(
      mirrored.map(({ offset, transform, opacity }) => ({
        offset,
        transform,
        ...(opacity === undefined ? {} : { opacity }),
      })),
      timing,
    ),
    placed.content.animate(
      mirrored.map(({ offset, clipPath }) => ({ offset, clipPath })),
      timing,
    ),
  ];
  const sync = () => {
    for (const animation of animations) animation.startTime = slide.startTime;
  };
  if (slide.startTime !== null) sync();
  else void slide.ready.then(sync, () => undefined);
  const last = mirrored.at(-1);
  const end: Look = {
    transform: last === undefined || last.transform === "none" ? "" : last.transform,
    clipPath: last === undefined || last.clipPath === "inset(0%)" ? "" : last.clipPath,
  };
  return { animations, end };
}
