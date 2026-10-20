/**
 * Where the viewer puts a picture and how it moves it, as plain numbers in
 * window pixels. The picture rests at one rect; every other place it shows
 * (on its thumbnail, zoomed, swiped aside) is a pose: that rect moved and
 * scaled from its top-left corner, so each move is a transform the
 * compositor plays.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point, Size {}

/** The resting rect translated by (x, y) and scaled by `scale` about its top-left corner. */
export interface Pose extends Point {
  readonly scale: number;
}

export const REST: Pose = { x: 0, y: 0, scale: 1 };

/**
 * Room the picture leaves around itself: the sides, the top under the title
 * bar, and the foot, which holds the caption.
 */
export const MARGIN = { side: 56, top: 40, foot: 72 } as const;

/** The gap between the picture and its caption. */
export const CAPTION_GAP = 14;

/** The window's room for a picture, under a title bar `topInset` tall. */
export function room(viewport: Size, topInset: number): Rect {
  const top = MARGIN.top + topInset;
  return {
    x: MARGIN.side,
    y: top,
    width: Math.max(0, viewport.width - 2 * MARGIN.side),
    height: Math.max(0, viewport.height - top - MARGIN.foot),
  };
}

/**
 * Where a picture of `natural` pixels rests: as large as the room allows
 * with its shape kept, centred, and never wider than its own pixels, so a
 * small picture isn't blown up into a blur.
 */
export function fit(natural: Size, space: Rect): Rect {
  if (natural.width <= 0 || natural.height <= 0) {
    return { x: space.x + space.width / 2, y: space.y + space.height / 2, width: 0, height: 0 };
  }
  const scale = Math.min(space.width / natural.width, space.height / natural.height, 1);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    x: space.x + (space.width - width) / 2,
    y: space.y + (space.height - height) / 2,
    width,
    height,
  };
}

/** A resting picture's corner: the card's, or an eighth of its short side when it is small. */
export function corner(size: Size, card: number): number {
  return Math.max(0, Math.min(card, Math.min(size.width, size.height) / 8));
}

/**
 * Where an element draws a picture of `natural` pixels inside its `box`, by
 * its `object-fit`, centred as `object-position` is by default. A cover
 * spills past the box; the box clips it.
 */
export function drawnRect(box: Rect, natural: Size, objectFit: string): Rect {
  if (natural.width <= 0 || natural.height <= 0 || objectFit === "fill" || objectFit === "") {
    return box;
  }
  const contain = Math.min(box.width / natural.width, box.height / natural.height);
  const scale =
    objectFit === "cover"
      ? Math.max(box.width / natural.width, box.height / natural.height)
      : objectFit === "none"
        ? 1
        : objectFit === "scale-down"
          ? Math.min(1, contain)
          : contain;
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** How much of `rect` shows through every one of `clips` (0…1). */
export function visibleShare(rect: Rect, clips: readonly Rect[]): number {
  const area = rect.width * rect.height;
  if (area <= 0) return 0;
  let shown: Rect | null = rect;
  for (const clip of clips) {
    shown = shown && intersect(shown, clip);
  }
  return shown ? (shown.width * shown.height) / area : 0;
}

/** A thumbnail counts as the place to fly from or to when at least this share of it is in view. */
export const IN_VIEW = 0.5;

/** A clip in the figure's own (unposed) pixels: insets from each side and a corner. */
export interface Clip {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly radius: number;
}

/** The figure's own shape at rest: the whole picture, with its corner. */
export function restingClip(radius: number): Clip {
  return { top: 0, right: 0, bottom: 0, left: 0, radius };
}

/**
 * The pose and clip that lay a figure resting at `rest` exactly over a
 * thumbnail: the thumbnail draws the picture at `drawn`, of which `shown`
 * is visible (its crop), with corners of `radius`. From here the picture
 * lifts out: the pose goes to rest, and the crop opens out to the whole.
 */
export function onThumbnail(
  rest: Rect,
  drawn: Rect,
  shown: Rect,
  radius: number,
): { readonly pose: Pose; readonly clip: Clip } {
  const scale = rest.width > 0 ? drawn.width / rest.width : 1;
  const local = (pixels: number) => Math.max(0, pixels / scale);
  return {
    pose: { x: drawn.x - rest.x, y: drawn.y - rest.y, scale },
    clip: {
      top: local(shown.y - drawn.y),
      right: local(drawn.x + drawn.width - (shown.x + shown.width)),
      bottom: local(drawn.y + drawn.height - (shown.y + shown.height)),
      left: local(shown.x - drawn.x),
      radius: local(radius),
    },
  };
}

/** A pose as a CSS transform (origin at the figure's top left). */
export function poseTransform(pose: Pose): string {
  return `translate(${round(pose.x)}px, ${round(pose.y)}px) scale(${round(pose.scale, 5)})`;
}

/** A clip as a CSS clip-path. */
export function clipPath(clip: Clip): string {
  return `inset(${round(clip.top)}px ${round(clip.right)}px ${round(clip.bottom)}px ${round(clip.left)}px round ${round(clip.radius)}px)`;
}

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

/** The pose a picture shrinks to while it fades out in place, with no thumbnail to go home to. */
export function fadedPose(rest: Rect): Pose {
  return scaledAboutCentre(rest, 0.94);
}

export function scaledAboutCentre(rest: Rect, scale: number): Pose {
  return {
    x: (rest.width * (1 - scale)) / 2,
    y: (rest.height * (1 - scale)) / 2,
    scale,
  };
}

/** The pose zoomed to `scale` about a window point, which stays over the same spot of the picture. */
export function zoomAbout(pose: Pose, rest: Rect, point: Point, scale: number): Pose {
  const ratio = scale / pose.scale;
  return {
    x: point.x - rest.x - (point.x - rest.x - pose.x) * ratio,
    y: point.y - rest.y - (point.y - rest.y - pose.y) * ratio,
    scale,
  };
}

/**
 * A pose kept on screen: along an axis where the picture is larger than the
 * window, no gap shows at either edge; along one where it is smaller, it is
 * centred where it rests.
 */
export function clampPose(pose: Pose, rest: Rect, viewport: Size): Pose {
  const axis = (offset: number, start: number, length: number, span: number) => {
    const size = length * pose.scale;
    if (size <= span) return (length - size) / 2;
    const at = start + offset;
    return Math.min(0, Math.max(span - size, at)) - start;
  };
  return {
    x: axis(pose.x, rest.x, rest.width, viewport.width),
    y: axis(pose.y, rest.y, rest.height, viewport.height),
    scale: pose.scale,
  };
}

/** How far a drag `over` past an edge shows: it gives less the further it goes, never past `span`. */
export function rubber(over: number, span: number): number {
  if (span <= 0 || over === 0) return 0;
  return Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / span + 1)) * span;
}

/** A pose dragged past where `clampPose` would keep it, held back by `rubber`. */
export function rubberPose(pose: Pose, rest: Rect, viewport: Size): Pose {
  const kept = clampPose(pose, rest, viewport);
  return {
    x: kept.x + rubber(pose.x - kept.x, viewport.width),
    y: kept.y + rubber(pose.y - kept.y, viewport.height),
    scale: pose.scale,
  };
}

/** The zoom a double-click goes to: twice the fit, or the picture's own pixels if those are more. */
export function detailZoom(natural: Size, rest: Rect): number {
  return Math.max(2, rest.width > 0 ? natural.width / rest.width : 2);
}

/** The most a picture zooms: four times the fit, or twice its own pixels. */
export function mostZoom(natural: Size, rest: Rect): number {
  return Math.max(4, rest.width > 0 ? (2 * natural.width) / rest.width : 4);
}

/** Zooms this close to rest are rest. */
export const AT_REST = 1.01;

/** How far a pinch may take the picture while the fingers are down. */
export function pinchRange(most: number): { readonly least: number; readonly most: number } {
  return { least: 0.4, most: most * 1.25 };
}

/** What a pinch let go at `scale` does: closes when well below rest, else settles in range. */
export function pinchRelease(scale: number, most: number): "close" | "rest" | "hold" | "most" {
  if (scale < 0.8) return "close";
  if (scale <= 1.02) return "rest";
  return scale > most ? "most" : "hold";
}

/** How much of the dim stays while a pinch shrinks the picture below rest (0…1). */
export function lightsDuringPinch(scale: number): number {
  return Math.min(1, Math.max(0, (scale - 0.4) / 0.6));
}

/** A swipe turns past this much travel (px)… */
export const SWIPE_TRAVEL = 72;
/** …or as a flick: this fast (px/s) and this far, the same way. */
export const FLICK_SPEED = 480;
export const FLICK_TRAVEL = 12;

/**
 * Where a swipe let go goes: 1 to the next item (the picture pushed left),
 * -1 to the previous, 0 back to where it was. `travel` is how far the
 * picture moved (px, + to the right), `velocity` its speed as it was let go.
 */
export function swipeStep(travel: number, velocity: number): -1 | 0 | 1 {
  const toward = (move: number): -1 | 1 => (move < 0 ? 1 : -1);
  if (Math.abs(travel) > SWIPE_TRAVEL) return toward(travel);
  if (
    Math.abs(velocity) > FLICK_SPEED &&
    Math.abs(travel) > FLICK_TRAVEL &&
    Math.sign(velocity) === Math.sign(travel)
  ) {
    return toward(travel);
  }
  return 0;
}
