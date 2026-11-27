// Which way a Cell's row swipes on the home: T3's row hands control here
// (`features/threads/thread-list-v2-items.tsx`, `features/home/thread-swipe-actions.tsx`).

/**
 * Which edge a row's main swipe stands on. A Cell moves the way the stages run, left to right:
 * Sleep is a swipe right, toward Asleep; Wake, back toward Awake, stays a swipe left, and so
 * does Snooze's menu of times, where a swipe left finds options.
 */
export function swipeEdgeOf(primary: string): "leading" | "trailing" {
  return primary === "settle" ? "leading" : "trailing";
}

/** What a row's swipes do, read aloud, in our words whatever upstream's labels say. */
export function swipeHint(primary: string, label: string, snoozes: boolean): string {
  if (primary === "settle")
    return `Opens the Cell. Swipe right to sleep${snoozes ? ", left to choose when it wakes" : ""}.`;
  const action = primary === "unsettle" || primary === "unsnooze" ? "wake" : label.toLowerCase();
  return `Opens the Cell. Swipe left to ${action}${snoozes ? ", or to choose when it wakes" : ""}.`;
}

/** A row's last place under the finger, its time (ms) and its speed there (pt/s). */
export interface Flick {
  readonly x: number;
  readonly t: number;
  readonly v: number;
}

export const AT_REST: Flick = { x: 0, t: 0, v: 0 };

/** A finger held this long (ms) has stopped, whatever it did before. */
const STOPPED_MS = 80;
/** How far a let-go row carries, as seconds of its speed: a quick flick reaches the end. */
const TOSS_S = 0.15;

/** The row stands at `x` at `now`: its speed follows the finger, smoothed over a few frames. */
export function sampled(before: Flick, x: number, now: number): Flick {
  "worklet";
  const dt = now - before.t;
  if (dt <= 0) return before;
  if (before.t === 0 || dt > STOPPED_MS) return { x, t: now, v: 0 };
  return { x, t: now, v: before.v * 0.35 + ((x - before.x) / dt) * 650 };
}

/** Where the row would carry if let go at `x` now: a still finger carries it nowhere. */
export function reach(flick: Flick, x: number, now: number): number {
  "worklet";
  return now - flick.t > STOPPED_MS ? x : x + flick.v * TOSS_S;
}

/** The slide out of a row let go past its full swipe, ms: T3's own, or quicker for a quick flick. */
const SLIDE = { least: 140, most: 220 } as const;

/**
 * How long a row let go at `speed` (pt/s) takes to slide out its last `remaining` points on T3's
 * ease out, so it leaves as fast as the finger let it go rather than jumping or dragging.
 */
export function slideMs(remaining: number, speed: number): number {
  "worklet";
  // An ease-out cubic starts at three times its mean speed.
  const matched = speed > 0 ? ((3 * remaining) / speed) * 1000 : SLIDE.most;
  return Math.min(Math.max(matched, SLIDE.least), SLIDE.most);
}

export { thrown } from "./hops";
