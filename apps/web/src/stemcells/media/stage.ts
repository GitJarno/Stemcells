/**
 * The viewer's motion: the picture lifting out of its thumbnail, stepping
 * to its neighbours, zooming, following the fingers, and landing home. Each
 * move is a transform (and the crop a clip-path) played by the compositor;
 * nothing re-renders while the picture moves. A newer move takes the
 * picture from wherever it is on screen: latest input wins.
 */
import { reducedMotion, spring, timed } from "../tokens/motion.ts";
import { cssLinear, settledDuration } from "../tokens/spring.ts";
import {
  AT_REST,
  CAPTION_GAP,
  REST,
  clampPose,
  clipPath,
  corner,
  fadedPose,
  lightsDuringPinch,
  poseTransform,
  restingClip,
  rubber,
  rubberPose,
  scaledAboutCentre,
  zoomAbout,
  type Clip,
  type Point,
  type Pose,
  type Rect,
  type Size,
} from "./geometry";

/** Where the picture flies from or to: a thumbnail's pose and crop. */
export interface Place {
  readonly pose: Pose;
  readonly clip: Clip;
}

const tokenNumber = (name: string): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/** How long the caption waits for the picture to arrive before it shows (ms). */
const CAPTION_DELAY = 240;

/** Shrinking the picture out of view, with no place to land, starts from here. */
const FADED_SCALE = 0.94;

export class Stage {
  readonly #figure: HTMLElement;
  readonly #scrim: HTMLElement;
  readonly #caption: HTMLElement;
  #rest: Rect | null = null;
  #corner = 0;
  #pose: Pose = REST;
  #lights = 0;
  #captionShown = false;
  /** Set once the picture is on its way home: no other move may cut that short. */
  #landing = false;

  constructor(parts: { figure: HTMLElement; scrim: HTMLElement; caption: HTMLElement }) {
    this.#figure = parts.figure;
    this.#scrim = parts.scrim;
    this.#caption = parts.caption;
  }

  get rest(): Rect | null {
    return this.#rest;
  }

  get pose(): Pose {
    return this.#pose;
  }

  get zoomed(): boolean {
    return this.#pose.scale > AT_REST;
  }

  /** The dim at its full depth: black at `veil-lights-down`. */
  get #lightsDown(): number {
    return tokenNumber("--sc-veil-lights-down");
  }

  /** Lays the picture at rest in `rest`, at once. */
  place(rest: Rect): void {
    if (this.#landing) return;
    this.#hold(this.#figure);
    this.#rest = rest;
    this.#corner = corner(rest, tokenNumber("--sc-radius-card"));
    const figure = this.#figure.style;
    figure.left = `${rest.x}px`;
    figure.top = `${rest.y}px`;
    figure.width = `${rest.width}px`;
    figure.height = `${rest.height}px`;
    figure.opacity = "1";
    this.#posed(REST);
    this.#setPose(REST);
    figure.clipPath = clipPath(restingClip(this.#corner));
    const caption = this.#caption.style;
    caption.left = `${rest.x + rest.width / 2}px`;
    caption.top = `${rest.y + rest.height + CAPTION_GAP}px`;
  }

  /** Nothing to show yet (its size is still loading): the stage stays dim and empty. */
  blank(): void {
    if (this.#landing) return;
    this.#hold(this.#figure);
    this.#figure.style.opacity = "0";
    this.hideCaption();
  }

  /**
   * The picture comes up: out of a thumbnail at `from`, or, with none to
   * come from, fading and growing in place. The lights go down with it.
   */
  lift(from: Place | null): void {
    const fade = timed("fade");
    this.#dim(1, reducedMotion() ? fade : "lift");
    if (reducedMotion() || from === null || this.#rest === null) {
      const grow = !reducedMotion() && this.#rest !== null;
      this.#play(
        this.#figure,
        {
          opacity: ["0", "1"],
          ...(grow
            ? {
                transform: [
                  poseTransform(scaledAboutCentre(this.#rest!, FADED_SCALE)),
                  poseTransform(REST),
                ],
              }
            : {}),
        },
        grow ? "lift" : fade,
        { opacity: fade },
      );
    } else {
      this.#play(
        this.#figure,
        {
          transform: [poseTransform(from.pose), poseTransform(REST)],
          clipPath: [clipPath(from.clip), clipPath(restingClip(this.#corner))],
        },
        "lift",
      );
    }
    this.#posed(REST);
    this.showCaption(CAPTION_DELAY);
  }

  /**
   * The picture goes home into the thumbnail at `to` as the lights come up,
   * or fades and shrinks where it is when there is none. `done` runs once
   * it is there.
   */
  land(to: Place | null, done: () => void): void {
    this.#landing = true;
    this.hideCaption();
    const leave = timed("leave");
    const reduce = reducedMotion();
    this.#dim(0, to === null || reduce ? leave : "land");
    const from = this.#poseNow();
    this.#hold(this.#figure);
    let move: Animation;
    if (to === null || reduce || this.#rest === null) {
      move = this.#play(
        this.#figure,
        {
          opacity: [this.#figure.style.opacity || "1", "0"],
          ...(reduce || this.#rest === null
            ? {}
            : {
                transform: [
                  poseTransform(from),
                  poseTransform(
                    this.zoomed
                      ? { ...from, scale: from.scale * FADED_SCALE }
                      : fadedPose(this.#rest),
                  ),
                ],
              }),
        },
        reduce || this.#rest === null ? leave : "land",
        { opacity: leave },
      );
    } else {
      move = this.#play(
        this.#figure,
        {
          transform: [poseTransform(from), poseTransform(to.pose)],
          clipPath: [this.#figure.style.clipPath, clipPath(to.clip)],
        },
        "land",
      );
    }
    void move.finished.then(done, done);
  }

  /** The picture steps aside for its neighbour: a copy of it leaves the way the reel went. */
  stepOut(direction: -1 | 1): void {
    if (this.#landing) return;
    const from = this.#poseNow();
    this.#hold(this.#figure);
    const ghost = this.#figure.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("id");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    // A copy of a video is a new player: keep it still and silent.
    ghost.querySelectorAll("video").forEach((video) => {
      video.autoplay = false;
      video.muted = true;
      video.pause();
    });
    this.#figure.before(ghost);
    const leave = timed("leave");
    const exit = ghost.animate(
      { opacity: [ghost.style.opacity || "1", "0"] },
      { duration: leave.duration, easing: leave.easing, fill: "forwards" },
    );
    if (!reducedMotion()) {
      const settle = spring("settle");
      const away = { ...from, x: from.x - direction * tokenNumber("--sc-step-travel") };
      ghost.animate(
        { transform: [poseTransform(from), poseTransform(away)] },
        { duration: settledDuration(settle) * 1000, easing: cssLinear(settle), fill: "forwards" },
      );
    }
    void exit.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
    this.#figure.style.opacity = "0";
    this.hideCaption();
  }

  /** The new picture comes in from the side the reel went toward. */
  stepIn(direction: -1 | 1): void {
    if (this.#landing) return;
    const fade = timed("fade");
    const reduce = reducedMotion();
    this.#play(
      this.#figure,
      {
        opacity: ["0", "1"],
        ...(reduce
          ? {}
          : {
              transform: [
                poseTransform({ ...REST, x: direction * tokenNumber("--sc-step-travel") }),
                poseTransform(REST),
              ],
            }),
      },
      reduce ? fade : "settle",
      { opacity: fade },
    );
    this.#posed(REST);
    this.showCaption(0);
  }

  /** Nothing further that way: the picture leans toward it and comes back. */
  lean(direction: -1 | 1): void {
    if (this.#landing) return;
    if (reducedMotion() || this.zoomed) return;
    const from = this.#poseNow();
    this.#hold(this.#figure);
    const out = { ...REST, x: direction * tokenNumber("--sc-lean-travel") };
    const nudge = this.#play(
      this.#figure,
      { transform: [poseTransform(from), poseTransform(out)] },
      "nudge",
    );
    void nudge.finished.then(() => {
      if (this.#figure.getAnimations().includes(nudge)) return;
      this.#settleTo(REST);
    }, noop);
    this.#posed(out);
  }

  /** Zooms to `scale` about a window point (the centre when none), kept on screen. */
  zoomTo(scale: number, viewport: Size, point?: Point): void {
    if (this.#landing) return;
    const rest = this.#rest;
    if (rest === null) return;
    const about = point ?? { x: rest.x + rest.width / 2, y: rest.y + rest.height / 2 };
    const from = this.#poseNow();
    const to =
      scale <= AT_REST ? REST : clampPose(zoomAbout(from, rest, about, scale), rest, viewport);
    this.#hold(this.#figure);
    this.#setPose(from);
    if (reducedMotion()) this.#setPose(to);
    else this.#play(this.#figure, { transform: [poseTransform(from), poseTransform(to)] }, "lift");
    this.#posed(to);
    if (to.scale > AT_REST) this.hideCaption();
    else this.showCaption(0);
  }

  /** Moves a zoomed picture by (dx, dy) at once: past an edge it gives like rubber, or stops when `firm`. */
  panBy(dx: number, dy: number, viewport: Size, firm: boolean): void {
    if (this.#landing) return;
    const rest = this.#rest;
    if (rest === null) return;
    this.#hold(this.#figure);
    const moved = { ...this.#pose, x: this.#pose.x + dx, y: this.#pose.y + dy };
    this.#posed(moved);
    this.#setPose(firm ? clampPose(moved, rest, viewport) : rubberPose(moved, rest, viewport));
    if (firm) this.#posed(clampPose(moved, rest, viewport));
  }

  /** A pan let go: back inside the edges. */
  settlePan(viewport: Size): void {
    if (this.#landing) return;
    const rest = this.#rest;
    if (rest === null) return;
    this.#settleTo(clampPose(this.#pose, rest, viewport));
  }

  /** The picture follows a swipe `travel` px across, held back when nothing is that way. */
  swipeTo(travel: number, open: boolean, viewport: Size): void {
    if (this.#landing) return;
    this.#hold(this.#figure);
    this.#posed({ ...REST, x: open ? travel : rubber(travel, viewport.width) });
    this.#setPose(this.#pose);
    this.hideCaption();
  }

  /** A swipe that didn't turn: the picture goes back. */
  swipeBack(): void {
    if (this.#landing) return;
    this.#settleTo(REST);
    this.showCaption(0);
  }

  /** The fingers pinch the picture to `scale` about `point`, at once; below rest the lights come up with it. */
  pinch(scale: number, point: Point): void {
    if (this.#landing) return;
    const rest = this.#rest;
    if (rest === null) return;
    this.#hold(this.#figure);
    this.#posed(zoomAbout(this.#poseNow(), rest, point, scale));
    this.#setPose(this.#pose);
    this.#hold(this.#scrim);
    this.#lights = scale < 1 ? lightsDuringPinch(scale) : 1;
    this.#scrim.style.opacity = String(this.#lightsDown * this.#lights);
    this.hideCaption();
  }

  /** A pinch let go above rest: kept on screen, at `scale` at most. */
  settlePinch(scale: number, viewport: Size): void {
    if (this.#landing) return;
    const rest = this.#rest;
    if (rest === null) return;
    this.#dim(1, "settle");
    const capped =
      this.#pose.scale > scale
        ? zoomAbout(this.#pose, rest, centreOf(rest, this.#pose), scale)
        : this.#pose;
    const to = capped.scale <= AT_REST ? REST : clampPose(capped, rest, viewport);
    this.#settleTo(to);
    if (to.scale <= AT_REST) this.showCaption(0);
  }

  showCaption(delay: number): void {
    if (this.#captionShown) return;
    this.#captionShown = true;
    this.#hold(this.#caption);
    const fade = timed("fade");
    this.#caption.style.opacity = "1";
    this.#caption.animate(
      { opacity: ["0", "1"] },
      { duration: fade.duration, easing: fade.easing, delay, fill: "backwards" },
    );
  }

  hideCaption(): void {
    if (!this.#captionShown) return;
    this.#captionShown = false;
    this.#hold(this.#caption);
    this.#caption.style.opacity = "0";
  }

  #settleTo(to: Pose): void {
    const from = this.#poseNow();
    this.#hold(this.#figure);
    this.#posed(to);
    if (reducedMotion()) {
      this.#setPose(to);
      return;
    }
    this.#play(this.#figure, { transform: [poseTransform(from), poseTransform(to)] }, "settle");
  }

  /** The lights to `depth` (0…1 of their full dim), on a spring or a timed fade. */
  #dim(depth: number, motion: string | { duration: number; easing: string }): void {
    const from = this.#scrim.style.opacity || "0";
    this.#hold(this.#scrim);
    this.#lights = depth;
    this.#play(
      this.#scrim,
      {
        opacity: [getComputedStyle(this.#scrim).opacity || from, String(this.#lightsDown * depth)],
      },
      motion,
    );
  }

  /**
   * Plays `frames` on `element` and leaves it at their last values: on a
   * spring token by name, or a timed easing. `overrides` gives single
   * properties their own timing (a fade beside a spring).
   */
  #play(
    element: HTMLElement,
    frames: Record<string, [string, string]>,
    motion: string | { duration: number; easing: string },
    overrides: Record<string, { duration: number; easing: string }> = {},
  ): Animation {
    const timing =
      typeof motion === "string"
        ? (() => {
            const s = spring(motion);
            return { duration: settledDuration(s) * 1000, easing: cssLinear(s) };
          })()
        : motion;
    let longest: Animation | null = null;
    let longestDuration = -1;
    const own: Record<string, [string, string]> = {};
    for (const [property, values] of Object.entries(frames)) {
      element.style.setProperty(cssName(property), values[1]);
      const override = overrides[property];
      if (override) {
        const animation = element.animate(
          { [property]: values },
          { duration: override.duration, easing: override.easing },
        );
        if (override.duration > longestDuration) {
          longest = animation;
          longestDuration = override.duration;
        }
      } else {
        own[property] = values;
      }
    }
    if (Object.keys(own).length > 0) {
      const animation = element.animate(own, timing);
      if (timing.duration >= longestDuration) longest = animation;
    }
    return longest ?? element.animate({}, { duration: 0 });
  }

  /** Stops what `element` is playing, leaving it where it was on screen. */
  #hold(element: HTMLElement): void {
    for (const animation of element.getAnimations()) {
      if (animation.playState === "running" || animation.playState === "paused") {
        try {
          animation.commitStyles();
        } catch {
          // Not rendered: nothing to keep.
        }
      }
      animation.cancel();
    }
  }

  /** The pose the picture is at, or on its way to; a zoomed picture is marked for its cursor. */
  #posed(pose: Pose): void {
    this.#pose = pose;
    this.#figure.toggleAttribute("data-zoomed", pose.scale > AT_REST);
  }

  #setPose(pose: Pose): void {
    this.#figure.style.transform = poseTransform(pose);
  }

  /** The picture's pose as it is on screen, mid-move included. */
  #poseNow(): Pose {
    const transform = getComputedStyle(this.#figure).transform;
    if (!transform || transform === "none") return REST;
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42, scale: matrix.a };
  }
}

function centreOf(rest: Rect, pose: Pose): Point {
  return {
    x: rest.x + pose.x + (rest.width * pose.scale) / 2,
    y: rest.y + pose.y + (rest.height * pose.scale) / 2,
  };
}

function cssName(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function noop(): void {}
