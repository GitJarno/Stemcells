// The motion tokens as the page reads them: from the CSS the tokens
// generate, so a move here and a transition in a style sheet share one
// definition (`stemcells.css`).

import type { Spring } from "./spring.ts";

const style = (): CSSStyleDeclaration => getComputedStyle(document.documentElement);

/**
 * A CSS time in milliseconds. The tokens are written in `ms`, but the build
 * minifies each time to its shortest spelling, so `3000ms` reaches the page
 * as `3s`: the unit decides the scale. Anything else is no time, 0.
 */
export function cssMs(value: string): number {
  const time = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)?\s*$/i.exec(value);
  if (time === null) return 0;
  const n = Number(time[1]);
  if (!Number.isFinite(n)) return 0;
  return time[2]?.toLowerCase() === "s" ? n * 1000 : n;
}
const ms = cssMs;

/** A spring token: `page`, `unfold`, `travel`, … */
export function spring(name: string): Spring {
  const s = style();
  return {
    response: Number(s.getPropertyValue(`--sc-motion-${name}-response`)),
    damping: Number(s.getPropertyValue(`--sc-motion-${name}-damping`)),
  };
}

/** A token as a timed easing: its duration in milliseconds and its CSS easing. */
export function timed(name: string): { readonly duration: number; readonly easing: string } {
  const s = style();
  return {
    duration: ms(s.getPropertyValue(`--sc-motion-${name}-duration`)),
    easing: s.getPropertyValue(`--sc-motion-${name}-easing`).trim() || "linear",
  };
}

/** A timing token in milliseconds: `readBeforeAllow`, `answerUndo`, … */
export function timing(name: string): number {
  const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return ms(style().getPropertyValue(`--sc-timing-${kebab}`));
}

const reduce =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;

/** Whether the person asked for less motion: every move becomes a fade, and only what tracks a finger travels. */
export const reducedMotion = (): boolean => reduce?.matches === true;
