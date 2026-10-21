/**
 * The room's working beat: one wave of light, its crossing and the rest
 * after it, on one wall clock. Everything lit by a working Cell crosses on
 * it: the band over its composer's glass, the sheen over its working word,
 * upstream's live rows ("Thinking"), and anything else that wants to light
 * up in step. Every pane keeps the same beat, and one mounted later lands
 * mid-beat instead of restarting.
 *
 * One wave, not several in time: the crest crosses its pane once per beat,
 * and every lit surface in the pane shows it as it passes over that
 * surface (`crossing`), as if one light passed over the pane.
 *
 * On the web the wall clock is the document timeline: an endless animation
 * whose start sits on the shared phase (`onBeat`) is in step with every
 * other one, set once and then the browser's. What moves is a transform,
 * so the compositor runs it and no script or paint runs per frame.
 */
import { timing } from "../tokens/motion";

/** The crossing's curve's control points: nearly even across, softened where the light meets and leaves. */
const BEAT_POINTS = [0.3, 0.1, 0.7, 0.9] as const;

/** The crossing's curve: it glides, never lunges. */
export const BEAT_CURVE = `cubic-bezier(${BEAT_POINTS.join(", ")})`;

/**
 * How far clear of its pane's edges the crest waits and ends, in pixels:
 * past the widest band any lit surface draws (the glass narrows its band to
 * fit, `light.ts`), so through the rest nothing shows.
 */
export const CREST_REACH = 240;

/** A crossing and the rest after it, in milliseconds, from the timing tokens. */
export function beat(): { readonly pass: number; readonly rest: number; readonly period: number } {
  const pass = timing("glowPass");
  const rest = timing("glowRest");
  return { pass, rest, period: pass + rest };
}

/**
 * Where a loop of `cycle` ms starts on the document's timeline so its phase
 * is the wall clock's: the timeline counts from `timeOrigin`.
 */
export function beatStart(cycle: number, timeOrigin = performance.timeOrigin): number {
  return -(timeOrigin % cycle);
}

/** Puts an endless animation of `cycle` ms (an alternating one counts both ways) on the beat. */
export function onBeat<A extends Animation>(animation: A, cycle: number): A {
  animation.startTime = beatStart(cycle);
  return animation;
}

/** The pane a lit surface stands in, whose width the wave crosses; the window outside one. */
export function paneOf(element: Element): Element {
  return element.closest("[data-stemcells-pane]") ?? document.documentElement;
}

/**
 * Where `element` stands in its pane, from the pane's left edge, and the
 * pane's width. `element` is one that never moves itself (the box a band
 * slides in), so this is its place at rest; a pane mid-zoom counts in its
 * own pixels.
 */
export function standing(element: Element): { readonly left: number; readonly width: number } {
  const pane = paneOf(element);
  const frame = pane.getBoundingClientRect();
  const laid = pane instanceof HTMLElement ? pane.offsetWidth : 0;
  const scale = laid > 0 && frame.width > 0 ? frame.width / laid : 1;
  return {
    left: (element.getBoundingClientRect().left - frame.left) / scale - pane.clientLeft,
    width: pane.clientWidth,
  };
}

/**
 * Where a band's transform runs so its crest rides the pane's crest: the
 * crest goes from `CREST_REACH` clear of the pane's left edge to as far
 * past its right. `left` is where the sliding element stands in the pane
 * with no transform, `crest` where the band's crest stands in it.
 */
export function crossing(
  paneWidth: number,
  left: number,
  crest: number,
): { readonly from: number; readonly to: number } {
  return { from: -CREST_REACH - left - crest, to: paneWidth + CREST_REACH - left - crest };
}

/**
 * One working sweep: `element` slides along x from `from` to `to` pixels in
 * the beat's pass, rests, and goes again, on the beat. `lean` follows the
 * slide in the transform (a shear, say). `stepped` crosses on the Cells'
 * sprite clock instead of gliding (`sweepFrames`).
 */
export function sweep(
  element: Element,
  from: number,
  to: number,
  lean = "",
  stepped = false,
): Animation {
  const { pass, period } = beat();
  return onBeat(
    element.animate(sweepFrames(from, to, pass / period, lean, stepped), {
      duration: period,
      iterations: Infinity,
    }),
    period,
  );
}

/**
 * Re-aims a sweep in flight, on the same clock: its timing and phase stay,
 * so one that turns stepped or smooth goes on from where the crest is.
 */
export function resweep(
  animation: Animation,
  from: number,
  to: number,
  lean = "",
  stepped = false,
): void {
  const { pass, period } = beat();
  const effect = animation.effect;
  if (effect instanceof KeyframeEffect) {
    effect.setKeyframes(sweepFrames(from, to, pass / period, lean, stepped));
  }
}

/**
 * A sweep's frames: across in the first `share` of the beat, then held at
 * its end. Stepped, the crossing holds each place for a beat of the Cells'
 * sprite clock, on the same curve, so the compositor draws twelve frames a
 * second rather than one per refresh of the display.
 */
export function sweepFrames(
  from: number,
  to: number,
  share: number,
  lean = "",
  stepped = false,
): Keyframe[] {
  const at = (x: number) => `translateX(${x}px)${lean ? ` ${lean}` : ""}`;
  const held = [
    { offset: share, transform: at(to) },
    { offset: 1, transform: at(to) },
  ];
  if (!stepped) return [{ offset: 0, transform: at(from), easing: BEAT_CURVE }, ...held];
  const across = steppedFrames(beat().pass, timing("formStep"), beatEase, (progress) => ({
    transform: at(from + (to - from) * progress),
  }));
  return [
    ...across.slice(0, -1).map((frame) => ({ ...frame, offset: (frame.offset ?? 0) * share })),
    ...held,
  ];
}

/**
 * Frames for a loop that never rests (a drift, a breath), stepping `step`
 * ms apart instead of gliding: the compositor still runs it, but draws only
 * when a step lands, where a glide that never rests drew every frame the
 * display shows, 120 a second on a fast one. `frame` takes how far along the
 * loop is, 0 to 1, already eased by `ease`; play the frames with a linear
 * easing, on the beat.
 */
export function steppedFrames(
  duration: number,
  step: number,
  ease: (time: number) => number,
  frame: (progress: number) => Keyframe,
): Keyframe[] {
  const steps = Math.max(1, Math.round(duration / step));
  return Array.from({ length: steps + 1 }, (_, i) => ({
    ...frame(ease(i / steps)),
    offset: i / steps,
    easing: "step-end",
  }));
}

/** One coordinate of the beat's curve at parameter `s`, from its two control values. */
function bezier(s: number, a: number, b: number): number {
  const r = 1 - s;
  return 3 * r * r * s * a + 3 * r * s * s * b + s * s * s;
}

/** The curve's parameter where `coordinate` reaches `value` (both rise monotonically from 0 to 1). */
function solve(value: number, a: number, b: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (bezier(mid, a, b) < value) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** A `cubic-bezier(x1, y1, x2, y2)` easing at `time`, both 0 to 1. */
export function cubicEase(points: readonly [number, number, number, number], time: number): number {
  const [x1, y1, x2, y2] = points;
  return bezier(solve(time, x1, x2), y1, y2);
}

/** How far across the crossing is at `time`, both 0 to 1, as `BEAT_CURVE` eases it. */
export function beatEase(time: number): number {
  return cubicEase(BEAT_POINTS, time);
}

/** When the crossing is `progress` across, 0 to 1: `beatEase` run backwards. */
export function beatWhen(progress: number): number {
  const [x1, y1, x2, y2] = BEAT_POINTS;
  return bezier(solve(progress, y1, y2), x1, x2);
}

/**
 * A crossing for a band drawn by repainting (a background's place, not a
 * transform): only the stretch of the beat the crest spends over the box it
 * lights, when its band leaves `low` and reaches `high`, the places where it
 * is just off the box. Its value runs `from` to `to` as a sweep's does, in
 * twelve straight pieces along the curve, or `stepped`, holding each place
 * for a beat of the Cells' sprite clock; `start` is how far into the beat
 * the stretch begins and `span` how long it lasts, in milliseconds. Play it
 * with `eachBeat`: outside the stretch nothing runs, where an endless
 * animation holding still for the rest of the beat still woke the page on
 * every frame.
 */
export function paintedCrossing(
  from: number,
  to: number,
  low: number,
  high: number,
  frame: (x: number) => Keyframe,
  stepped = false,
): { readonly frames: Keyframe[]; readonly start: number; readonly span: number } {
  const { pass } = beat();
  const at = (x: number) => beatWhen(Math.min(1, Math.max(0, (x - from) / (to - from))));
  const enter = at(low);
  const leave = at(high);
  const span = Math.max(1, (leave - enter) * pass);
  const steps = stepped ? Math.max(1, Math.floor(span / timing("formStep"))) : 12;
  const easing = stepped ? "step-end" : "linear";
  const frames: Keyframe[] = [];
  for (let i = 0; i < steps; i++) {
    // A step shows where the crest is halfway through it, so a label the
    // crest crosses within one step still lights once.
    const time = enter + ((leave - enter) * (stepped ? i + 0.5 : i)) / steps;
    const x = i === 0 && !stepped ? low : from + (to - from) * beatEase(time);
    frames.push({ ...frame(x), offset: i / steps, easing });
  }
  frames.push({ ...frame(high), offset: 1 });
  return { frames, start: enter * pass, span };
}

/** A stretch of every beat that `element` animates through, and nothing between. */
export interface EachBeat {
  /** Plays `frames` over `span` ms, `start` ms into every beat, from this beat's if it is still to come or under way. */
  aim(frames: Keyframe[], start: number, span: number): void;
  cancel(): void;
}

/**
 * Plays a stretch of every beat on `element`, on the beat's wall clock: one
 * animation, which as it finishes is set to start again a beat on. Before
 * and after its stretch it neither shows nor runs.
 */
export function eachBeat(element: Element): EachBeat {
  let start = 0;
  let span = 1;
  let animation: Animation | null = null;
  const arm = () => {
    if (animation === null) return;
    const { period } = beat();
    const now = Number(document.timeline.currentTime ?? 0);
    const origin = beatStart(period);
    const at = origin + Math.floor((now - origin) / period) * period + start;
    animation.startTime = at + span <= now ? at + period : at;
  };
  return {
    aim(frames, nextStart, nextSpan) {
      start = nextStart;
      span = nextSpan;
      if (animation === null) {
        animation = element.animate(frames, { duration: span });
        animation.addEventListener("finish", arm);
      } else {
        const effect = animation.effect;
        if (effect instanceof KeyframeEffect) {
          effect.setKeyframes(frames);
          effect.updateTiming({ duration: span });
        }
      }
      arm();
    },
    cancel() {
      animation?.removeEventListener("finish", arm);
      animation?.cancel();
      animation = null;
    },
  };
}
