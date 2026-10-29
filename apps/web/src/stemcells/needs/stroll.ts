/**
 * A Cell's walk along a row of Aski's room (stemcells/tasks/one-ask.md, decision 4): a few
 * short steps, a foot's lift each, slowing as it arrives. It runs once and stops; with less
 * motion, nobody walks.
 */
import { reducedMotion } from "../tokens/motion";

/** How far one step takes it. */
const STEP_PX = 9;
const LIFT_PX = 2;
/** A walk's time by its length, a short one and a long one alike brisk. */
const MS_PER_PX = 1.5;
const SHORTEST_MS = 190;
const LONGEST_MS = 520;
const BOW_MS = 260;
const HOP_PX = 10;

export interface Walk {
  /** Where it starts and stops, in pixels from where it stands. */
  readonly from: number;
  readonly to: number;
  readonly delay?: number;
  /** Walking off, it stays where it stopped; walking on, it waits at its start. */
  readonly off?: boolean;
  /** Its last steps fade it out. */
  readonly fade?: boolean;
}

/** How long a walk of `distance` pixels takes. */
export const walkMs = (distance: number): number =>
  Math.min(LONGEST_MS, Math.max(SHORTEST_MS, Math.abs(distance) * MS_PER_PX));

export function walk(element: Element, step: Walk): Animation | null {
  // A walk off holds where it stopped: the next walk starts from the seat, not from there.
  for (const earlier of element.getAnimations()) earlier.cancel();
  if (reducedMotion()) return null;
  const { from, to, delay = 0, off = false, fade = false } = step;
  const steps = Math.max(2, Math.round(Math.abs(to - from) / STEP_PX));
  const frames = Array.from({ length: steps + 1 }, (_, at) => {
    const offset = at / steps;
    const x = from + (to - from) * (1 - (1 - offset) ** 1.5);
    const y = at % 2 === 1 && at < steps ? -LIFT_PX : 0;
    const opacity = fade && offset > 0.55 ? 1 - (offset - 0.55) / 0.45 : 1;
    return { offset, transform: `translate(${x}px, ${y}px)`, opacity };
  });
  return element.animate(frames, {
    duration: walkMs(to - from),
    delay,
    easing: "linear",
    fill: off ? "forwards" : "backwards",
  });
}

/** Answered, it bows and hops up and away, off to work, clear of the next ask's words. */
export function bowOut(element: Element): void {
  if (reducedMotion()) return;
  element.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: `translateY(${LIFT_PX}px)`, opacity: 1, offset: 0.3 },
      { transform: `translateY(${-HOP_PX}px)`, opacity: 1, offset: 0.65 },
      { transform: `translateY(${-HOP_PX * 1.5}px)`, opacity: 0 },
    ],
    { duration: BOW_MS, easing: "ease-out", fill: "forwards" },
  );
}

/** What isn't a Cell, such as the line's count, slides to its new place without steps. */
export function slide(element: Element, from: number, delay: number): void {
  for (const earlier of element.getAnimations()) earlier.cancel();
  if (reducedMotion()) return;
  element.animate([{ transform: `translateX(${from}px)` }, { transform: "none" }], {
    duration: walkMs(from),
    delay,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fill: "backwards",
  });
}

/** How far left `element` must walk to be off the left edge of `stage`, which clips it. */
export const offLeft = (element: Element, stage: Element): number =>
  stage.getBoundingClientRect().left - element.getBoundingClientRect().right - 2;

/** How far right it starts to come on from the right edge of `stage`. */
export const offRight = (element: Element, stage: Element): number =>
  stage.getBoundingClientRect().right - element.getBoundingClientRect().left + 2;
