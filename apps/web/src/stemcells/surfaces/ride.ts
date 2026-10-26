/**
 * A native surface rides the page it sits on. The desktop browser is a view fixed over the app at
 * its slot's last rect (`upstream/surfaces.ts`), presented again only on a resize, so a sliding
 * page left it behind. While the pages move (`data-moving`), the view's page follows its slot by a
 * transform, nothing for React or the guest to redraw; at rest the slot presents where it is.
 */

/** A shown view, and the point upstream placed it at. */
export interface PlacedView {
  /**
   * The view, fixed over the app: it is cut to the pages' frame and keeps still. A cut that moved
   * with the page ran a frame behind it on the compositor, and the page showed over the rail.
   */
  readonly element: HTMLElement;
  /** The box inside it at its top-left, holding the page: it is moved. */
  readonly content: HTMLElement;
  readonly x: number;
  readonly y: number;
}

export interface Rider {
  /** The slot: the box the view is placed over. */
  readonly anchor: HTMLElement;
  /** The view, while it is shown; null while it isn't. */
  readonly view: () => PlacedView | null;
  /** Where the views are, shown or not; null if nowhere yet. */
  readonly views: () => Node | null;
  /** The pages rest: the slot presents again, where it is now. */
  readonly rest: () => void;
  /** The `fade` token's timing, that a view coming while the pages move fades in on. */
  readonly fade: () => KeyframeAnimationOptions;
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
  /** The view we cut and whose page we move, by inline style or by a copy of a slide. */
  let held: PlacedView | null = null;
  /** The slide the page has a copy of, the copy, and where the view was placed for it. */
  let mirrored: { slide: Animation; copy: Animation; placed: PlacedView } | null = null;
  /** The view shown as the pages set off, or the last that came since: none of them fades in. */
  let came: HTMLElement | null = null;
  let frame = 0;

  const unmirror = () => {
    mirrored?.copy.cancel();
    mirrored = null;
  };
  const letGo = () => {
    unmirror();
    if (held === null) return;
    held.element.style.overflow = "";
    held.element.style.clipPath = "";
    held.element.style.backgroundColor = "";
    held.content.style.transform = "";
    held = null;
  };
  const set = (
    style: CSSStyleDeclaration,
    property: "overflow" | "clipPath" | "backgroundColor" | "transform",
    value: string,
  ) => {
    if (style[property] !== value) style[property] = value;
  };

  const follow = () => {
    const placed = rider.view();
    if (placed?.element !== held?.element || placed?.content !== held?.content) letGo();
    if (placed === null) return;
    if (placed.element !== came) {
      came = placed.element;
      placed.element.animate([{ opacity: 0 }, { opacity: 1 }], rider.fade());
    }
    held = placed;
    const size = { width: placed.element.offsetWidth, height: placed.element.offsetHeight };
    // The page moves out of the view's box, so the view shows past it, up to
    // the frame, and its ground, which stays, goes.
    set(placed.element.style, "overflow", "visible");
    set(placed.element.style, "backgroundColor", "transparent");
    set(placed.element.style, "clipPath", frameCut(placed, size, pages.getBoundingClientRect()));
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
    const copy = slide === null ? null : mirror(slide, at, placed);
    if (slide !== null && copy !== null) {
      mirrored = { slide, copy: copy.animation, placed };
      // Where the slide ends: the page stays there once it and its copy are done.
      set(placed.content.style, "transform", copy.end);
    } else {
      set(placed.content.style, "transform", moveBy({ x: at.x - placed.x, y: at.y - placed.y }));
    }
  };

  const loop = () => {
    frame = requestAnimationFrame(loop);
    follow();
  };
  // A finger's stroke is written to the strip in the pager's own frame
  // callback, and a view is shown by a render, either of which may land
  // after ours: following each write as it lands keeps the page on the frame
  // it is drawn in, and a view that comes is cut and faded before it paints.
  const writes = new MutationObserver(follow);
  const watch = () => {
    if (pages.hasAttribute("data-moving")) {
      if (frame !== 0) return;
      came = rider.view()?.element ?? null;
      const style = { attributes: true, attributeFilter: ["style"], subtree: true };
      writes.observe(pages, style);
      const views = rider.views();
      if (views !== null) writes.observe(views, { ...style, childList: true });
      loop();
    } else if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
      writes.disconnect();
      unmirror();
      // The slot presents where it is now, at once: the view is in place
      // before anything paints, and the move and the cut go.
      rider.rest();
      letGo();
    }
  };
  const moving = new MutationObserver(watch);
  moving.observe(pages, { attributes: true, attributeFilter: ["data-moving"] });
  watch();

  return () => {
    moving.disconnect();
    writes.disconnect();
    cancelAnimationFrame(frame);
    frame = 0;
    letGo();
  };
}

/** The pager's slide, running on its strip (the pages' child that holds the slot), if one is. */
function slideOf(anchor: HTMLElement, pages: HTMLElement): Animation | null {
  let strip: HTMLElement | null = anchor;
  while (strip !== null && strip.parentElement !== pages) strip = strip.parentElement;
  for (const animation of strip?.getAnimations() ?? []) {
    if (animation.playState !== "running" || !(animation.effect instanceof KeyframeEffect)) {
      continue;
    }
    if (animation.effect.getKeyframes().some((key) => key.transform || key.opacity)) {
      return animation;
    }
  }
  return null;
}

/** A move of the page by `by`, as inline style writes it: none when it hasn't moved. */
export function moveBy(by: Point): string {
  return Math.abs(by.x) < 0.5 && Math.abs(by.y) < 0.5 ? "" : `translate3d(${by.x}px, ${by.y}px, 0)`;
}

/**
 * The view's cut to the pages' frame, `bounds`, in the view's own box (of
 * `size`, at `placed`): past the box where the frame reaches beyond it, as
 * the page moves out of it.
 */
export function frameCut(placed: Point, size: Size, bounds: Box): string {
  const top = bounds.top - placed.y;
  const right = placed.x + size.width - bounds.right;
  const bottom = placed.y + size.height - bounds.bottom;
  const left = bounds.left - placed.x;
  const px = (value: number) => `${Number(value.toFixed(2))}px`;
  return `inset(${px(top)} ${px(right)} ${px(bottom)} ${px(left)})`;
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

/** A key of the page's copy: its move, and the slide's fade. */
export interface MirroredKey {
  readonly offset: number;
  readonly transform: string;
  readonly opacity?: string | number | undefined;
}

/**
 * The page's keys for a slide whose keys move its target as given: the page
 * moves as the slot does, from where the view was placed.
 */
export function mirroredKeys(
  keys: readonly SlideKey[],
  slot: Point,
  now: Point,
  placed: Point,
): MirroredKey[] {
  return keys.map((key) => ({
    offset: key.offset,
    transform:
      moveBy({
        x: slot.x + key.transform.x - now.x - placed.x,
        y: slot.y + key.transform.y - now.y - placed.y,
      }) || "none",
    ...(key.opacity === undefined ? {} : { opacity: key.opacity }),
  }));
}

/**
 * A copy of `slide` on the view's page, started with it; null when it can't be copied. A slide
 * runs on the compositor, on through a main thread busy with the turn it sets off, so the page
 * can't follow it frame by frame as it follows a finger.
 */
function mirror(
  slide: Animation,
  slot: DOMRect,
  placed: PlacedView,
): { animation: Animation; end: string } | null {
  const effect = slide.effect;
  if (!(effect instanceof KeyframeEffect) || !(effect.target instanceof HTMLElement)) return null;
  const target = effect.target;
  const box = { width: target.offsetWidth, height: target.offsetHeight };
  const computed = getComputedStyle(target).transform;
  const matrix = computed === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(computed);
  const now = { x: matrix.m41, y: matrix.m42 };
  const keys: SlideKey[] = [];
  for (const key of effect.getKeyframes()) {
    // Between keys the page must move as the slot does: in a straight line.
    if (key.easing !== undefined && key.easing !== "linear") return null;
    // A key that doesn't move the strip (a fade, under reduced motion) leaves it where it is.
    const move =
      key.transform === undefined ? now : translation(key.transform as string | undefined, box);
    if (move === null) return null;
    keys.push({ offset: key.computedOffset, transform: move, opacity: key.opacity ?? undefined });
  }
  const mirrored = mirroredKeys(keys, slot, now, placed);
  const animation = placed.content.animate(
    mirrored.map((key) => ({ ...key })),
    effect.getTiming(),
  );
  const sync = () => {
    animation.startTime = slide.startTime;
  };
  if (slide.startTime !== null) sync();
  else void slide.ready.then(sync, () => undefined);
  const last = mirrored.at(-1);
  return { animation, end: last === undefined || last.transform === "none" ? "" : last.transform };
}
