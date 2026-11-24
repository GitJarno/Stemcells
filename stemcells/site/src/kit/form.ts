// The hand that holds the page: one story, staged for a phone, an iPad or a
// desk (`stemcells/brand/book.md`, Every screen is the first screen).

export type Form = "phone" | "tablet" | "desk";

/** A finger, not a mouse: nothing hovers, and a drag is the natural throw. */
export const touch = matchMedia("(hover: none), (pointer: coarse)").matches;

export const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Which staging a box `width` by `height` CSS pixels gets. */
export function formOf(width: number, height: number): Form {
  if (width < 700) return "phone";
  if (width < 1100 || (touch && width < height)) return "tablet";
  return "desk";
}

/** Device pixels a CSS pixel, whole and at most 3: glyphs keep their edges on whole pixels. */
export const density = (): number => Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));

export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** Where `v` stands between `a` and `b`, held to 0..1. */
export const span = (v: number, a: number, b: number): number => clamp((v - a) / (b - a));
export const ease = {
  inOut: (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  out: (u: number): number => 1 - (1 - u) ** 3,
  in: (u: number): number => u * u * u,
  outBack: (u: number): number => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
};
/** A steady number in 0..1 from `n` and a seed: the page never rolls dice mid-scene. */
export function hash(n: number, seed = 0): number {
  const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
