// One Cell on Aski's stage, drawn twice, a far copy under Aski and a near one over it, one
// showing: passing behind Aski is then an opacity change the compositor plays, not a stacking
// change, which it can't, and they swap only where the Cell stands clear of Aski. Where a Cell
// is comes from its move, never layout, so a move taken over mid-flight starts where it shows.

import { type Spring, settledDuration, springAt, springEasing } from "../../tokens/spring.ts";
import { bodyOf, frameShown, sceneFor } from "../../cell/cast.ts";
import { BOX, moodOf, POINTS_PER_PIXEL } from "../../cell/look.ts";
import { paint } from "../../cell/paint.ts";
import { packLook } from "../../cell/scene.ts";
import { angleAt, behind, type Metrics, type Orbit, orbitPose, type Pose } from "./stage.ts";

/** A hop into Aski: up, over and in. Theater: hand-set for this one move. */
export const HOP = {
  duration: 520,
  /** How high it rises, in shares of Aski's size, and when it tops out. */
  rise: 0.22,
  top: 0.42,
  up: "cubic-bezier(0.2, 0.7, 0.4, 1)",
  down: "cubic-bezier(0.6, 0, 0.9, 0.5)",
  /** How small it is by the time it is inside. */
  scale: 0.5,
} as const;

/** The orbit drawn as straight steps this many to a turn: under a tenth of a pixel off the ellipse. */
const STEPS = 72;
/** How long the copies take to change over at the orbit's ends: one keyframe apart, too short to see. */
const SWAP = 1e-4;

type Move =
  | { readonly kind: "still" }
  | {
      readonly kind: "travel";
      readonly from: Pose;
      readonly spring: Spring;
      readonly velocity: number;
      readonly start: number;
      readonly animation: Animation;
    }
  | {
      readonly kind: "orbit";
      readonly offset: number;
      readonly orbit: Orbit;
      readonly metrics: Metrics;
      readonly animations: readonly Animation[];
    }
  | { readonly kind: "fade"; readonly animation: Animation };

const css = (p: Pose): Keyframe => ({
  transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) scale(${p.scale.toFixed(4)})`,
  opacity: p.opacity.toFixed(4),
});

const HIDDEN: Keyframe = { opacity: "0" };

/** One copy of a Cell's character. */
interface Copy {
  readonly root: HTMLElement;
  /** Its picture: what it wears, its mood's face, its provider's colours. */
  readonly canvas: HTMLCanvasElement;
}

function copy(layer: Element): Copy {
  const root = document.createElement("div");
  root.className = "stage-cell";
  const canvas = document.createElement("canvas");
  canvas.className = "character";
  canvas.style.width = `${BOX.width * POINTS_PER_PIXEL}px`;
  canvas.style.height = `${BOX.height * POINTS_PER_PIXEL}px`;
  canvas.setAttribute("aria-hidden", "true");
  root.append(canvas);
  root.style.opacity = "0";
  layer.append(root);
  return { root, canvas };
}

export class Actor {
  readonly #near: Copy;
  readonly #far: Copy;
  readonly #now: () => number;
  #pose: Pose = { x: 0, y: 0, scale: 1, opacity: 0 };
  /** Whether the far copy is the one showing (outside the orbit, where the orbit's own frames decide). */
  #behind = false;
  #move: Move = { kind: "still" };
  /** Bumped by every move, so a landing that was taken over does nothing. */
  #turn = 0;
  /** The face, provider and pieces it wears. */
  #look = "";

  /** `now` is the document timeline's time in milliseconds, the clock every animation here runs on. */
  constructor(layers: { readonly far: Element; readonly near: Element }, now: () => number) {
    this.#far = copy(layers.far);
    this.#near = copy(layers.near);
    this.#now = now;
  }

  /** Wears a mood's face in its provider's colours (absent: the coral Cell's), and the pieces it was dealt. */
  dress(mood: string, provider: string | undefined, worn: readonly string[] = []): void {
    const look = `${moodOf(mood)} ${provider ?? ""} ${worn.join(" ")}`;
    if (look === this.#look) return;
    this.#look = look;
    const scene = sceneFor(packLook(worn), moodOf(mood), undefined, 0);
    const frame = frameShown(scene, "", undefined, false);
    for (const c of [this.#near, this.#far])
      paint(c.canvas, frame, bodyOf(provider), POINTS_PER_PIXEL, devicePixelRatio || 1);
  }

  /** Where the Cell is drawn now. */
  pose(): Pose {
    return this.#poseAt(this.#now());
  }

  /** How fast the Cell moves now, in pixels per second. */
  velocity(): { x: number; y: number } {
    const now = this.#now();
    const h = 4;
    const a = this.#poseAt(now - h);
    const b = this.#poseAt(now + h);
    return { x: ((b.x - a.x) * 1000) / (2 * h), y: ((b.y - a.y) * 1000) / (2 * h) };
  }

  #poseAt(time: number): Pose {
    const move = this.#move;
    if (move.kind === "orbit")
      return orbitPose(move.orbit, move.metrics, angleAt(move.offset, time, move.orbit.period));
    if (move.kind === "travel") {
      const t = Math.max(0, (time - move.start) / 1000);
      return mix(move.from, this.#pose, springAt(move.spring, t, move.velocity));
    }
    return this.#pose;
  }

  /** Where the Cell rests, or is on its way to; absent while it goes round the orbit. */
  get target(): Pose | undefined {
    return this.#move.kind === "orbit" ? undefined : this.#pose;
  }

  /** Stands the Cell at `pose` at once, in front of Aski unless `far`. */
  stand(pose: Pose, far = false): void {
    this.#stop();
    this.#pose = pose;
    this.#behind = far;
    this.#draw();
  }

  /**
   * Carries the Cell to `to` on a spring, leaving from where it is with the
   * speed it has along the way. It goes behind Aski when `far` says so (or
   * stays on the side it is on), and lands in front of Aski, or in the orbit
   * when `land` starts it there.
   */
  travel(to: Pose, spring: Spring, options: { far?: boolean; land?: () => void } = {}): void {
    const from = this.pose();
    const v = this.velocity();
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = dx * dx + dy * dy;
    this.#behind = options.far ?? this.#behindNow();
    if (
      span < 0.25 &&
      Math.abs(to.scale - from.scale) < 0.01 &&
      Math.abs(to.opacity - from.opacity) < 0.01
    ) {
      this.stand(to);
      options.land?.();
      return;
    }
    // The speed it has, as a share of this move per second.
    const velocity = span < 0.25 ? 0 : (v.x * dx + v.y * dy) / span;
    this.#stop();
    const showing = this.#behind ? this.#far : this.#near;
    const hidden = this.#behind ? this.#near : this.#far;
    hidden.root.style.opacity = "0";
    const start = this.#now();
    // The spring as keyframes the Cell passes through in straight lines, the
    // points its linear() easing would have: WebKit plays keyframes on the
    // compositor, but an animation eased by linear() on the main thread.
    const frames = springEasing(spring, velocity).map((p) => ({
      ...css(mix(from, to, p.value)),
      offset: p.at,
    }));
    const animation = showing.root.animate(frames, {
      duration: settledDuration(spring, velocity) * 1000,
    });
    animation.startTime = start;
    this.#pose = to;
    Object.assign(showing.root.style, css(to));
    this.#move = { kind: "travel", from, spring, velocity, start, animation };
    const turn = ++this.#turn;
    void animation.finished.then(
      () => {
        if (this.#turn !== turn) return;
        animation.cancel();
        if (options.land !== undefined) options.land();
        else this.stand(to);
      },
      () => undefined,
    );
  }

  /** Fades the Cell in where it stands: a move under Reduce Motion, which moves nothing. */
  fadeIn(timing: { readonly duration: number; readonly easing: string }): void {
    const showing = this.#behind ? this.#far : this.#near;
    showing.root.animate([HIDDEN, { opacity: String(this.#pose.opacity) }], timing);
  }

  /**
   * Starts the Cell round the orbit, holding the angle `offset` at time 0,
   * so it is where every other Cell's place in the orbit says it is.
   */
  orbit(orbit: Orbit, m: Metrics, offset: number): void {
    this.#stop();
    const now = this.#now();
    const near: Keyframe[] = [];
    const far: Keyframe[] = [];
    // One turn from angle 0, the orbit's trailing end, going the way time turns it: its far half first.
    for (let k = 0; k <= STEPS; k++) {
      const u = k / STEPS;
      const a = -2 * Math.PI * u;
      const frame = css(orbitPose(orbit, m, a));
      const hidden = { ...frame, opacity: "0" };
      if (k === STEPS / 2) {
        // At the leading end the Cell comes out from behind Aski.
        far.push({ ...frame, offset: u }, { ...hidden, offset: u + SWAP });
        near.push({ ...hidden, offset: u }, { ...frame, offset: u + SWAP });
        continue;
      }
      const isBehind = k > 0 && k < STEPS / 2;
      far.push({ ...(isBehind || k === 0 ? frame : hidden), offset: u });
      near.push({ ...(isBehind || k === 0 ? hidden : frame), offset: u });
    }
    // Angle 0 is where a turn begins; the animation starts when this Cell was last there.
    const period = orbit.period;
    const zero = (offset / (2 * Math.PI)) * period;
    const start = zero - period * Math.ceil((zero - now) / period);
    const animations = [this.#far, this.#near].map((c, i) => {
      const animation = c.root.animate(i === 0 ? far : near, {
        duration: period,
        iterations: Infinity,
      });
      animation.startTime = start;
      return animation;
    });
    this.#move = { kind: "orbit", offset, orbit, metrics: m, animations };
    this.#pose = orbitPose(orbit, m, angleAt(offset, now, period));
    this.#behind = behind(angleAt(offset, now, period));
  }

  /** Holds the orbit still, or lets it go on from where the clock says it is now. */
  hold(held: boolean): void {
    if (this.#move.kind !== "orbit") return;
    const period = this.#move.orbit.period;
    const zero = (this.#move.offset / (2 * Math.PI)) * period;
    for (const animation of this.#move.animations) {
      if (held) animation.pause();
      else animation.startTime = zero - period * Math.ceil((zero - this.#now()) / period);
    }
  }

  /**
   * Hops into Aski at `inside`: up, over and in, getting smaller, gone by the
   * time it lands. It goes behind Aski where it can do so unseen. Resolves
   * when it is gone; the copies are then removed.
   */
  hop(inside: Pose, aski: number): Promise<void> {
    const from = this.pose();
    const far = this.#behindNow() || !this.#over();
    this.stand(from, far);
    const top = { x: (from.x + inside.x) / 2, y: Math.min(from.y, inside.y) - HOP.rise * aski };
    const showing = far ? this.#far : this.#near;
    const end = { ...inside, scale: HOP.scale * from.scale, opacity: 0 };
    const animation = showing.root.animate(
      [
        { ...css(from), easing: HOP.up },
        {
          ...css({ ...top, scale: from.scale, opacity: from.opacity }),
          offset: HOP.top,
          easing: HOP.down,
        },
        css(end),
      ],
      { duration: HOP.duration, fill: "forwards" },
    );
    ++this.#turn;
    this.#move = { kind: "fade", animation };
    return animation.finished.then(
      () => this.remove(),
      () => undefined,
    );
  }

  /** Fades out where it stands, then is removed: leaving under Reduce Motion. */
  fadeOut(timing: { readonly duration: number; readonly easing: string }): Promise<void> {
    const from = this.pose();
    const far = this.#behindNow();
    this.stand(from, far);
    ++this.#turn;
    const animation = (far ? this.#far : this.#near).root.animate(
      [{ opacity: String(from.opacity) }, HIDDEN],
      {
        ...timing,
        fill: "forwards",
      },
    );
    this.#move = { kind: "fade", animation };
    return animation.finished.then(
      () => this.remove(),
      () => undefined,
    );
  }

  remove(): void {
    this.#stop();
    this.#near.root.remove();
    this.#far.root.remove();
  }

  /** Whether the showing copy is the far one now. */
  #behindNow(): boolean {
    if (this.#move.kind !== "orbit") return this.#behind;
    return behind(angleAt(this.#move.offset, this.#now(), this.#move.orbit.period));
  }

  /** Whether the Cell stands where Aski's figure may cover it: anywhere in the orbit but its ends. */
  #over(): boolean {
    return (
      this.#move.kind === "orbit" &&
      Math.abs(Math.cos(angleAt(this.#move.offset, this.#now(), this.#move.orbit.period))) < 0.9
    );
  }

  #stop(): void {
    const move = this.#move;
    this.#move = { kind: "still" };
    ++this.#turn;
    if (move.kind === "travel" || move.kind === "fade") move.animation.cancel();
    if (move.kind === "orbit") for (const animation of move.animations) animation.cancel();
  }

  #draw(): void {
    const showing = this.#behind ? this.#far : this.#near;
    const hidden = this.#behind ? this.#near : this.#far;
    Object.assign(showing.root.style, css(this.#pose));
    Object.assign(hidden.root.style, { ...css(this.#pose), opacity: "0" });
  }
}

const mix = (a: Pose, b: Pose, u: number): Pose => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
  scale: a.scale + (b.scale - a.scale) * u,
  opacity: a.opacity + (b.opacity - a.opacity) * u,
});
