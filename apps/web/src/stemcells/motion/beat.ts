/**
 * The room's working beat: a wave's crossing and the rest after it, on one
 * wall clock. Everything lit by a working Cell crosses on it: the band over
 * its composer's glass, the sheen over its working word, and anything else
 * that wants to light up in step. Every pane keeps the same beat, and one
 * mounted later lands mid-beat instead of restarting.
 *
 * On the web the wall clock is the document timeline: an endless animation
 * whose start sits on the shared phase (`onBeat`) is in step with every
 * other one, set once and then the browser's.
 */
import { timing } from "../tokens/motion";

/** Nearly even across, softened where the light meets and leaves: it glides, never lunges. */
export const BEAT_CURVE = "cubic-bezier(0.3, 0.1, 0.7, 0.9)";

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

/**
 * One working sweep: `element` slides along x from `from` to `to` pixels in
 * the beat's pass, rests, and goes again, on the beat. `lean` follows the
 * slide in the transform (a shear, say).
 */
export function sweep(element: Element, from: number, to: number, lean = ""): Animation {
  const { pass, period } = beat();
  return onBeat(
    element.animate(sweepFrames(from, to, pass / period, lean), {
      duration: period,
      iterations: Infinity,
    }),
    period,
  );
}

/** A sweep's frames: across in the first `share` of the beat, then held at its end. */
export function sweepFrames(from: number, to: number, share: number, lean = ""): Keyframe[] {
  const at = (x: number) => `translateX(${x}px)${lean ? ` ${lean}` : ""}`;
  return [
    { offset: 0, transform: at(from), easing: BEAT_CURVE },
    { offset: share, transform: at(to) },
    { offset: 1, transform: at(to) },
  ];
}
