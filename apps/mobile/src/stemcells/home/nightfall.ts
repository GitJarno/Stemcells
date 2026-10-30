// How night falls over Settled and lifts off it (stemcells/tasks/nightfall.md), apart from its
// views so Node can test it. One progress runs it, 0 day to 1 night: each part of the night reads
// its own span of the nightfall from it, so the night turns back from wherever it stands.

/** The nightfall, ms; dawn, quicker; and Reduce Motion's crossfade, either way. */
export const NIGHTFALL_MS = 1100;
export const DAWN_MS = 380;
const CROSSFADE_MS = 200;

/** Each part's span, ms into the nightfall, over which it comes in; stars brightest first. */
export const PARTS = {
  sky: [0, 520],
  moon: [180, 700],
  glow: [320, 880],
  stars: [
    [300, 700],
    [500, 900],
    [700, 1100],
  ],
} as const;

export type Part = readonly [number, number];

/** As the moon settles, Aski notices: its slow blink, ms into the nightfall, and each beat's. */
export const NOTICE_MS = 560;
export const SLOW_BLINK = { close: 160, hold: 140, open: 240 } as const;

/** Every beat's curve: quick, then settling into stillness. */
export function easeOut(t: number): number {
  "worklet";
  return 1 - (1 - t) ** 3;
}

/** How far `part` has come in once night has `fallen` this far; under Reduce Motion, all as one. */
export function shown(fallen: number, part: Part, reduced: boolean): number {
  "worklet";
  if (reduced) return fallen;
  return easeOut(Math.min(1, Math.max(0, (fallen * NIGHTFALL_MS - part[0]) / (part[1] - part[0]))));
}

/**
 * The turn from `at` toward night or day, or none when it stands there: night falls at its own
 * steady pace from wherever it is, and Aski notices if it passes the moment; dawn eases out
 * (`easeOut`), taking the rest of its curve from where it starts.
 */
export function turn(at: number, night: boolean, reduced: boolean) {
  "worklet";
  const to = night ? 1 : 0;
  const way = Math.abs(to - at);
  if (way === 0) return null;
  if (reduced) return { to, ms: CROSSFADE_MS * way, eased: false, notices: false };
  if (night)
    return { to, ms: NIGHTFALL_MS * way, eased: false, notices: at * NIGHTFALL_MS < NOTICE_MS };
  return { to, ms: DAWN_MS * Math.cbrt(way), eased: true, notices: false };
}
