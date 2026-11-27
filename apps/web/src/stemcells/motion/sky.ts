/**
 * The sky behind the phone's header and the column's head (stemcells/tasks/day-night.md): day
 * over Input and Awake, night over Asleep, and nothing between. Plain numbers and colours, so the
 * phone reads them too (`line/kit.ts`). One progress, 0 day to 1 night, drives every layer. The
 * phone runs these on its UI thread, hence the worklets.
 */

import type { Bezier } from "./listMotion";

export type Span = readonly [from: number, to: number];
export type Scheme = "light" | "dark";

export const SKY_AT = { day: 0, night: 1 } as const;

/** The sky a stage stands under: Asleep's night, and day over the rest. */
export function skyAtStage(stage: string): number {
  return stage === "asleep" ? SKY_AT.night : SKY_AT.day;
}

/**
 * How long a turn takes for the whole way, day to night or back (a partial one takes its share),
 * and its one curve: it decelerates, so the sky answers in the switch's own frame and settles.
 */
export const SKY_TURN = {
  nightfall: 520,
  daybreak: 420,
  /** Reduce Motion's crossfade, from anywhere to anywhere. */
  crossfade: 160,
  /** The shortest turn: a nudge still eases. */
  least: 100,
  easing: [0.2, 0, 0, 1] as Bezier,
} as const;

/**
 * Each layer's span of the progress, played forward into night and back into day. The night
 * comes in before the day lifts, so the ground never shows between them, and the sun is gone
 * before the moon comes: one body at a time.
 */
export const SKY_SPANS = {
  sunGoes: [0, 0.4],
  sunSinks: [0, 0.45],
  cloudsGo: [0, 0.5],
  nightDeepens: [0, 0.6],
  dayLifts: [0.35, 1],
  moonComes: [0.5, 0.9],
  moonRises: [0.5, 1],
  stars: [
    [0.35, 0.75],
    [0.5, 0.9],
    [0.6, 1],
  ],
} as const satisfies Record<string, Span | readonly Span[]>;

/** How far through `span` the progress `p` is, 0 to 1. */
function along(p: number, span: Span): number {
  "worklet";
  return Math.min(1, Math.max(0, (p - span[0]) / (span[1] - span[0])));
}

/** How far a layer has come in at `p`, eased in and out. */
export function shown(p: number, span: Span): number {
  "worklet";
  const t = along(p, span);
  return t * t * (3 - 2 * t);
}

/**
 * The turn from `at` to `to`, or none when the sky stands there. It sets off from where it is and
 * takes its share of the whole way's time. Under Reduce Motion, one short linear crossfade.
 */
export function skyTurn(
  at: number,
  to: number,
  reduced: boolean,
): { readonly to: number; readonly ms: number; readonly eased: boolean } | null {
  "worklet";
  const way = Math.abs(to - at);
  if (way === 0) return null;
  if (reduced) return { to, ms: SKY_TURN.crossfade, eased: false };
  const whole = to > at ? SKY_TURN.nightfall : SKY_TURN.daybreak;
  return { to, ms: Math.max(SKY_TURN.least, whole * way), eased: true };
}

interface Gradient {
  readonly zenith: string;
  readonly horizon: string;
}

export interface SkyPalette {
  readonly day: Gradient;
  readonly night: Gradient;
  readonly sun: string;
  readonly moon: string;
  /** The moon's unlit part, a little lighter than the sky it crosses. */
  readonly moonShadow: string;
  /** How strong the sun's and the moon's halo are at their heart. */
  readonly halo: number;
  /** The sunlit haze round the sun by day, wide and faint. */
  readonly haze: Tint;
  readonly cloud: Tint;
  readonly star: string;
  /** The stars' alphas are scaled by this: a light night needs them brighter. */
  readonly starLight: number;
  /** What crosses the day now and then (`SKY_VISITS`): a seed's down, and birds far off. */
  readonly seed: Tint;
  readonly birds: Tint;
  /** The header's ink and the ground under the sky, as the app's theme sets them. */
  readonly ink: string;
  readonly ground: string;
}

interface Tint {
  readonly colour: string;
  readonly alpha: number;
}

/**
 * Day is a clear sky dimmed to sit at the edge of the eye beside the list all day: in the dark
 * appearance a deep, quiet blue, paler toward the horizon, never a dusk's plum; in the light one a
 * pale morning blue fading into the white screen. A warm-white sun in a wide faint haze, and two
 * soft clouds. Night keeps its deep indigo, the moon and the stars.
 */
export const SKY: Readonly<Record<Scheme, SkyPalette>> = {
  dark: {
    day: { zenith: "#132440", horizon: "#2A4161" },
    night: { zenith: "#04050D", horizon: "#141938" },
    sun: "#F6EDDD",
    moon: "#F2EFE6",
    moonShadow: "#1A1D3A",
    halo: 0.14,
    haze: { colour: "#EADFC8", alpha: 0.14 },
    cloud: { colour: "#FFFFFF", alpha: 0.07 },
    star: "#FFFFFF",
    starLight: 1,
    seed: { colour: "#EFEBE2", alpha: 0.55 },
    birds: { colour: "#0A1222", alpha: 0.75 },
    ink: "#F5F5F5",
    ground: "#0D0D0D",
  },
  light: {
    day: { zenith: "#BED4EC", horizon: "#E4EDF7" },
    night: { zenith: "#7F89BB", horizon: "#B9BFDF" },
    sun: "#FFFAF0",
    moon: "#FFFFFF",
    moonShadow: "#6E78AA",
    halo: 0.5,
    haze: { colour: "#FFF4DC", alpha: 0.55 },
    cloud: { colour: "#FFFFFF", alpha: 0.6 },
    star: "#FFFFFF",
    starLight: 2,
    seed: { colour: "#FFFFFF", alpha: 0.95 },
    birds: { colour: "#4B5B78", alpha: 0.55 },
    ink: "#27272A",
    ground: "#FCFCFC",
  },
};

/** The sky's shape, in points on the phone and pixels on the Mac. */
export const SKY_SHAPE = {
  /** How far past the first row's top the sky fades out. */
  tail: 20,
  /** The sun and the moon: their radius, how far the sun sinks and the moon rises, the halo's reach in radii. */
  body: { r: 10, sinks: 6, rises: 6, halo: 2.6 },
} as const;

/** One stop of a sky's gradient, top to bottom. */
export interface SkyStop {
  readonly offset: number;
  readonly colour: string;
  readonly opacity: number;
}

const FADE_STEPS = 10;

/**
 * A sky's stops: whole down to `whole` (a share of its height), zenith to horizon, then fading out
 * on a curve with no visible start or end, so its foot is the ground beneath at any progress.
 */
export function skyStops(gradient: Gradient, whole: number): SkyStop[] {
  const top = Math.min(0.9, Math.max(0, whole));
  const offsets = [
    0,
    ...Array.from({ length: FADE_STEPS + 1 }, (_, n) => top + ((1 - top) * n) / FADE_STEPS),
  ];
  return offsets
    .filter((offset, n) => n === 0 || offset > offsets[n - 1]!)
    .map((offset) => {
      const t = offset <= top ? 0 : (offset - top) / (1 - top);
      return {
        offset,
        colour: mix(gradient.zenith, gradient.horizon, offset),
        opacity: 1 - t * t * t * (t * (t * 6 - 15) + 10),
      };
    });
}

const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `a` toward `b` by `t`, in sRGB, as `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const from = channels(a);
  const to = channels(b);
  return `#${from
    .map((c, n) =>
      Math.round(c + (to[n]! - c) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** `hex` at `alpha`, as CSS writes it. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 1000) / 1000})`;
}

/** WCAG's contrast between two colours. */
export function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = channels(hex).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** The colour the sky shows at `offset` down it, over its ground. */
export function skyOver(gradient: Gradient, whole: number, offset: number, ground: string): string {
  const stops = skyStops(gradient, whole);
  const after = stops.findIndex((stop) => stop.offset >= offset);
  const b = stops[Math.max(0, after)]!;
  const a = stops[Math.max(0, after - 1)]!;
  const t = b.offset === a.offset ? 0 : (offset - a.offset) / (b.offset - a.offset);
  const colour = mix(a.colour, b.colour, t);
  return mix(ground, colour, a.opacity + (b.opacity - a.opacity) * t);
}

/** A star: across the sky's width and down its reach, as shares, its radius and alpha. */
export interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly alpha: number;
}

/**
 * The stars by brightness, one group to each of their spans, brightest first. The same on every
 * screen: seeded, and kept clear of where the moon stands (`clearOf`, a share across).
 */
export function starGroups(clearOf: number): Star[][] {
  let seed = 46;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const stars = Array.from({ length: 52 }, () => ({
    x: random(),
    y: random(),
    r: 0.4 + random() * 0.7,
    alpha: 0.1 + random() * 0.34,
  })).filter((star) => Math.abs(star.x - clearOf) > 0.07 || star.y < 0.2);
  const brightest = [...stars].sort((a, b) => b.alpha - a.alpha);
  const size = Math.ceil(brightest.length / SKY_SPANS.stars.length);
  return SKY_SPANS.stars.map((_, n) => brightest.slice(n * size, (n + 1) * size));
}

/** Two soft clouds, each a few lobes: centre across and down the sky's reach, as shares; lobes in points. */
export const CLOUDS = [
  {
    x: 0.22,
    y: 0.34,
    lobes: [
      { dx: 0, dy: 0, rx: 58, ry: 7 },
      { dx: -16, dy: -4, rx: 24, ry: 6 },
      { dx: 14, dy: -6, rx: 30, ry: 8 },
    ],
  },
  {
    x: 0.6,
    y: 0.66,
    lobes: [
      { dx: 0, dy: 0, rx: 44, ry: 5 },
      { dx: 9, dy: -4, rx: 20, ry: 5 },
    ],
  },
] as const;

/**
 * Now and then something crosses the sky, and between visits nothing moves: by night a shooting
 * star, by day a dandelion's seed drifting on the air or a few birds far off. Seldom, small and
 * soft at both ends, so it rewards a glance without drawing one; never under Reduce Motion, and
 * only while the sky is on screen.
 */
export type SkyVisitor = "shootingStar" | "seed" | "birds";

export const SKY_VISITS = {
  /** The wait between visits, least to most, in ms. */
  night: [14_000, 34_000],
  day: [30_000, 75_000],
  /** The first comes sooner once the sky has turned: this share of a wait. */
  first: 0.3,
  /** How long each takes to cross, in ms. */
  ms: { shootingStar: 900, seed: 14_000, birds: 9_000 },
  /** The share of day's visits that are birds; the rest are seeds. */
  birds: 0.3,
} as const;

export interface SkyVisit {
  readonly kind: SkyVisitor;
  readonly wait: number;
  /** Where it sets off, across the sky and down the stars' reach, as shares. */
  readonly x: number;
  readonly y: number;
}

/** The next visit to a day or night sky; `first`, the first since it turned. */
export function nextVisit(night: boolean, first: boolean, random: () => number): SkyVisit {
  const [least, most] = night ? SKY_VISITS.night : SKY_VISITS.day;
  const wait = (least + random() * (most - least)) * (first ? SKY_VISITS.first : 1);
  if (night) return { kind: "shootingStar", wait, x: random() * 0.35, y: 0.04 + random() * 0.26 };
  if (random() < SKY_VISITS.birds)
    return { kind: "birds", wait, x: 0.02 + random() * 0.18, y: 0.15 + random() * 0.25 };
  return { kind: "seed", wait, x: 0.04 + random() * 0.3, y: 0.2 + random() * 0.25 };
}

/** Where a visitor is, `t` of the way through its crossing: points from where it set off. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  /** Degrees. */
  readonly rotate: number;
  readonly opacity: number;
}

/** In over the first `rise` of the way and out from `fall`, with no edge to either. */
function softly(t: number, rise: number, fall: number): number {
  "worklet";
  const up = Math.min(1, t / rise);
  const down = Math.min(1, Math.max(0, (1 - t) / (1 - fall)));
  const s = Math.min(up, down);
  return s * s * (3 - 2 * s);
}

/**
 * A shooting star: quick, slowing as it burns out, its tail along its way. It crosses a share of
 * the sky's `width` and falls a share of `reach`, the stars' own, so it burns out short of the
 * moon and above the head's controls.
 */
export function shootingStarAt(t: number, width: number, reach: number): Pose {
  "worklet";
  const e = 1 - (1 - t) * (1 - t);
  const across = Math.min(150, width * 0.4);
  const fall = Math.min(52, reach * 0.3);
  return {
    x: e * across,
    y: e * fall,
    rotate: (Math.atan2(fall, across) * 180) / Math.PI,
    opacity: t <= 0 ? 0 : Math.sin(Math.PI * t),
  };
}

/** A seed on the air: drifting across and a little up, rocking under its down, `width` the sky's. */
export function seedAt(t: number, width: number): Pose {
  "worklet";
  const sway = Math.PI * 2 * 1.3 * t;
  return {
    x: t * Math.min(240, width * 0.55),
    y: -t * 16 + Math.sin(sway) * 4,
    rotate: Math.sin(sway - 0.8) * 14,
    opacity: softly(t, 0.15, 0.7),
  };
}

/** Birds far off: gliding across on a gentle swell, `width` the sky's. */
export function birdsAt(t: number, width: number): Pose {
  "worklet";
  return {
    x: t * Math.min(320, width * 0.8),
    y: -t * 8 + Math.sin(Math.PI * 2 * 0.9 * t) * 2.5,
    rotate: 0,
    opacity: softly(t, 0.12, 0.8),
  };
}

/**
 * The `n`th bird's wings at `t` of a crossing of `ms`, as a vertical scale: a few beats, then a
 * glide with them held, and again; each bird a little out of step.
 */
export function wingAt(t: number, n: number, ms: number): number {
  "worklet";
  const s = (t * ms) / 1000 + n * 0.41;
  const beats = Math.sin((Math.PI * s) / 3.4) ** 2;
  return 0.6 - beats * 0.75 * Math.sin(Math.PI * 2 * 2.6 * s);
}

/** Three birds: from the leader, in points, and their size. Each is a 10 by 4 stroke. */
export const BIRDS = [
  { dx: 0, dy: 0, size: 1 },
  { dx: -13, dy: 5, size: 0.85 },
  { dx: -24, dy: 1, size: 0.72 },
] as const;
export const BIRD_PATH = "M0 4 Q2.6 0.6 5 3.4 Q7.4 0.6 10 4";

/** A seed in a 16 by 22 box: its down's filaments from (8, 8), its stalk, and the seed below. */
export const SEED = {
  heart: { x: 8, y: 8 },
  filaments: Array.from({ length: 9 }, (_, n) => {
    const angle = ((-72 + n * 18) * Math.PI) / 180;
    const reach = 6.4 - Math.abs(n - 4) * 0.25;
    return { x: 8 + Math.sin(angle) * reach, y: 8 - Math.cos(angle) * reach };
  }),
  stalk: { from: 8, to: 17 },
  seed: { y: 19, rx: 0.9, ry: 2 },
} as const;
