/**
 * The light in a Cell's composer, moving: the Swift app's glow layer on the
 * Web Animations API. Each change is set once and left to the browser, and
 * what loops while a Cell works is a transform or an opacity, so a working
 * chat costs no script per frame.
 *
 * `light` holds it all and hides once the glass is plain; `lit` is the
 * colour, the wash and the band, and is what the iris opens and gathers at
 * the anchor; `bloom` is the small flare where the light drains, outside the
 * iris so it is the last thing seen.
 */
import { crossing, onBeat, resweep, sweep } from "../motion/beat";
import { timing } from "../tokens/motion";
import {
  axial,
  BAND_LEAN,
  bandStops,
  bandWidth,
  BLOOM_REACH,
  bloomStops,
  type Glow,
  IRIS_SOLID,
  irisRadius,
  type Point,
  type Rgb,
  type Size,
  strength,
  WASH,
  washColours,
  washEnds,
} from "./light";

export interface GlassParts {
  readonly light: HTMLElement;
  readonly lit: HTMLElement;
  readonly wash: HTMLElement;
  /** The wash to its far end, and to where its far end drifts; the drift cross-fades them. */
  readonly near: HTMLElement;
  readonly far: HTMLElement;
  readonly band: HTMLElement;
  readonly bloom: HTMLElement;
}

/** The colours the light is made of, read off the page. */
export interface GlassInk {
  /** The provider's colour. */
  readonly tone: Rgb;
  /** Needs you. */
  readonly warm: Rgb;
  /** The glass under the light. */
  readonly glass: Rgb;
  /** Whether the words over it are lighter than the glass. */
  readonly lightInk: boolean;
}

const ARRIVE_CURVE = "cubic-bezier(0.2, 0, 0.4, 1)";
const EXHALE_CURVE = "cubic-bezier(0.3, 0, 0.5, 1)";
const EASE_OUT = "cubic-bezier(0, 0, 0.58, 1)";
const EASE_IN_OUT = "cubic-bezier(0.42, 0, 0.58, 1)";
/** A shear, not a rotation: the band's ends stay on the glass's edges, its top ahead. */
const LEAN = `skewX(${-BAND_LEAN}rad)`;
const WASH_COLOURS = WASH.map((_, i) => `--sc-glass-wash-${i}`);

const same = (a: GlassInk | null, b: GlassInk) =>
  a !== null &&
  a.lightInk === b.lightInk &&
  [a.tone, a.warm, a.glass].every((rgb, i) =>
    rgb.every((c, j) => c === [b.tone, b.warm, b.glass][i]![j]),
  );

export class GlassLight {
  private glow: Glow = "quiet";
  private ink: GlassInk | null = null;
  private still = false;
  private size: Size = { width: 0, height: 0 };
  private anchor: Point = { x: 0, y: 0 };
  private inset = 0;
  /** Where the glass stands in its pane, and the pane's width: the wave crosses the pane. */
  private pane = { left: 0, width: 0 };
  /** One more than the move before it: a finish that finds a newer move under way leaves things alone. */
  private transition = 0;
  /** What the move under way plays; the next move stops it where it is. */
  private playing: Animation[] = [];
  private sweeping: Animation | null = null;

  constructor(private readonly parts: GlassParts) {
    parts.light.style.visibility = "hidden";
    parts.lit.style.opacity = "0";
  }

  /**
   * The state, its colours and whether to keep still. `mounted` is the
   * first: a glass that mounts mid-work lands mid-beat, with no entrance.
   */
  configure(glow: Glow, ink: GlassInk, still: boolean, mounted = false): void {
    const recolour = !same(this.ink, ink);
    const restyle = still !== this.still;
    this.ink = ink;
    this.still = still;
    if (mounted) {
      this.glow = glow;
      this.paint(false);
      this.move("quiet", false);
    } else if (glow !== this.glow) {
      const from = this.glow;
      this.glow = glow;
      this.paint(from !== "quiet");
      this.move(from);
    } else if (recolour || restyle) {
      this.paint(glow !== "quiet");
      if (glow !== "quiet" && restyle) this.move(glow);
    }
  }

  /**
   * The glass's size, where the send button's centre stands in it and how
   * far in from the corner, and where the glass stands in its pane.
   */
  layout(size: Size, anchor: Point, inset: number, pane: { left: number; width: number }): void {
    if (
      size.width === this.size.width &&
      size.height === this.size.height &&
      anchor.x === this.anchor.x &&
      anchor.y === this.anchor.y &&
      inset === this.inset &&
      pane.left === this.pane.left &&
      pane.width === this.pane.width
    ) {
      return;
    }
    this.size = size;
    this.anchor = anchor;
    this.inset = inset;
    this.pane = pane;
    if (size.width <= 0 || size.height <= 0) return;
    const { lit, near, far, band, bloom } = this.parts;
    lit.style.setProperty("--iris-x", `${anchor.x}px`);
    lit.style.setProperty("--iris-y", `${anchor.y}px`);
    lit.style.setProperty("--iris-r", `${irisRadius(size, anchor)}px`);
    lit.style.setProperty("--iris-solid", `${IRIS_SOLID}`);
    // The wash runs from the anchor across the glass; its colours are
    // custom properties, so a recolour fades them without redrawing this.
    const ends = washEnds(size, anchor);
    const stops = WASH.map((stop, i) => [`var(${WASH_COLOURS[i]})`, stop.at] as const);
    near.style.backgroundImage = axial(size, anchor, ends.far, stops);
    far.style.backgroundImage = axial(size, anchor, ends.drift, stops);
    band.style.width = `${bandWidth(size)}px`;
    band.style.transform = `translateX(${this.reach().from}px) ${LEAN}`;
    const reach = inset * BLOOM_REACH;
    bloom.style.width = `${reach * 2}px`;
    bloom.style.height = `${reach * 2}px`;
    bloom.style.left = `${anchor.x - reach}px`;
    bloom.style.top = `${anchor.y - reach}px`;
    // A glass that changed size or place re-aims the sweep in flight, on the same clock.
    if (this.sweeping !== null) {
      const { from, to } = this.reach();
      resweep(this.sweeping, from, to, LEAN);
    }
  }

  /** Off the page: everything stops, and nothing under way finishes. */
  stop(): void {
    this.transition += 1;
    this.halt();
  }

  private halt(): void {
    for (const animation of this.playing) animation.cancel();
    this.playing = [];
    this.sweeping = null;
  }

  // MARK: - Colour

  private paint(animated: boolean): void {
    const ink = this.ink;
    if (ink === null) return;
    const { band, wash, bloom } = this.parts;
    // The band is the working tone's: it never shows while the glass asks.
    const alpha = strength(ink.tone, ink.glass, ink.lightInk);
    band.style.backgroundImage = `linear-gradient(to right, ${bandStops(ink.tone, alpha).join(", ")})`;
    bloom.style.backgroundImage = `radial-gradient(closest-side, ${bloomStops(ink.tone).join(", ")})`;
    const colours = washColours(this.glow === "needsYou" ? ink.warm : ink.tone);
    if (animated) {
      const now = getComputedStyle(wash);
      wash.animate(
        [
          Object.fromEntries(WASH_COLOURS.map((name) => [name, now.getPropertyValue(name)])),
          Object.fromEntries(WASH_COLOURS.map((name, i) => [name, colours[i]!])),
        ],
        { duration: timing("glowArrive") },
      );
    }
    WASH_COLOURS.forEach((name, i) => wash.style.setProperty(name, colours[i]!));
  }

  // MARK: - Motion

  /**
   * The band's pass: its crest, at its middle, rides the pane's crest, so
   * it crosses this glass as the one wave crosses the pane, and waits clear
   * of the glass through the rest.
   */
  private reach(): { from: number; to: number } {
    return crossing(this.pane.width, this.pane.left, bandWidth(this.size) / 2);
  }

  private play(element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = element.animate(frames, options);
    this.playing.push(animation);
    return animation;
  }

  /**
   * The state changed: play the way from `from` to where it is now.
   * `arriving` false plays the state's standing motion with no entrance.
   */
  private move(from: Glow, arriving = true): void {
    this.transition += 1;
    const id = this.transition;
    const { light, lit, wash, near, far, band, bloom } = this.parts;
    // Whatever was under way stops where it is; the new motion starts there.
    const shown = getComputedStyle(lit);
    const litNow = Number(shown.opacity);
    const irisNow = lit.hasAttribute("data-iris")
      ? Number(shown.getPropertyValue("--sc-glass-iris")) || 0
      : 1;
    this.halt();
    const after = (animation: Animation, body: () => void) =>
      animation.finished.then(
        () => this.transition === id && body(),
        () => undefined,
      );
    const fade = timing("glowFade");

    if (this.glow === "quiet") {
      lit.style.opacity = "0";
      if (from === "working" && !this.still && arriving) {
        // The exhale: the light gathers to the send button and drains, then
        // one small bloom where it went.
        const exhale = timing("glowExhale");
        const bloomFor = timing("glowBloom");
        lit.setAttribute("data-iris", "");
        lit.style.setProperty("--sc-glass-iris", "0");
        this.play(lit, [{ "--sc-glass-iris": irisNow }, { "--sc-glass-iris": 0 }], {
          duration: exhale,
          easing: EXHALE_CURVE,
        });
        this.play(lit, [{ opacity: litNow }, { opacity: litNow }], { duration: exhale });
        const begin = exhale - bloomFor * 0.6;
        this.play(bloom, [{ opacity: 0 }, { opacity: 1 }], {
          duration: bloomFor / 2,
          iterations: 2,
          direction: "alternate",
          easing: EASE_OUT,
          delay: begin,
        });
        const swell = this.play(
          bloom,
          [{ transform: "scale(0.55)" }, { transform: "scale(1.15)" }],
          {
            duration: bloomFor,
            easing: EASE_OUT,
            delay: begin,
          },
        );
        after(swell, () => {
          light.style.visibility = "hidden";
          lit.removeAttribute("data-iris");
        });
      } else {
        // A short fade: an answered ask (work usually follows at once), or
        // less motion.
        const out = this.play(lit, [{ opacity: litNow }, { opacity: 0 }], { duration: fade });
        after(out, () => {
          light.style.visibility = "hidden";
        });
      }
      return;
    }

    light.style.visibility = "";
    lit.style.opacity = "1";
    lit.removeAttribute("data-iris");
    if (from === "quiet" && arriving) {
      if (this.glow === "working" && !this.still) {
        // The colour washes out from the send button as the sent turn
        // lands, continuing that gesture rather than starting a second one.
        lit.setAttribute("data-iris", "");
        lit.style.setProperty("--sc-glass-iris", "1");
        const open = this.play(lit, [{ "--sc-glass-iris": 0 }, { "--sc-glass-iris": 1 }], {
          duration: timing("glowArrive"),
          delay: timing("glowLead"),
          fill: "backwards",
          easing: ARRIVE_CURVE,
        });
        after(open, () => lit.removeAttribute("data-iris"));
      } else {
        this.play(lit, [{ opacity: 0 }, { opacity: 1 }], { duration: fade });
      }
    } else if (from !== "quiet" && arriving && litNow < 1) {
      this.play(lit, [{ opacity: litNow }, { opacity: 1 }], { duration: fade });
    }

    if (this.glow === "working") {
      // Less motion: a still glow, the tint held.
      if (this.still) return;
      const { from, to } = this.reach();
      this.sweeping = sweep(band, from, to, LEAN);
      this.playing.push(this.sweeping);
      // The stained glass drifts: its far end wanders, so the light through
      // it is never quite still.
      const drift = timing("glowDrift");
      const wander: KeyframeAnimationOptions = {
        duration: drift / 2,
        iterations: Infinity,
        direction: "alternate",
        easing: EASE_IN_OUT,
      };
      onBeat(this.play(near, [{ opacity: 1 }, { opacity: 0 }], wander), drift);
      onBeat(this.play(far, [{ opacity: 0 }, { opacity: 1 }], wander), drift);
      return;
    }
    // Blocked on you: the tint breathes in place; with less motion it holds.
    if (from === "working") {
      this.play(band, [{ opacity: 1 }, { opacity: 0 }], { duration: fade, fill: "forwards" });
    }
    if (this.still) return;
    const breath = timing("glowBreath");
    const breathing = this.play(
      wash,
      [{ opacity: this.glow === "needsYou" ? 0.7 : 0.8 }, { opacity: 1 }],
      { duration: breath / 2, iterations: Infinity, direction: "alternate", easing: EASE_IN_OUT },
    );
    onBeat(breathing, breath);
  }
}
