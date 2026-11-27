/**
 * The sky behind the phone's header and the column's head (stemcells/tasks/day-night.md): dawn over
 * Input, day over Awake, night over Asleep. Plain numbers and colours, so the phone reads them too
 * (`line/kit.ts`). One progress, 0 day to 1 night, drives every layer, and dawn stands on the way:
 * the sun at the horizon, as at sunset. The phone runs these on its UI thread, hence the worklets.
 */

import type { Bezier } from "./listMotion";

export type Span = readonly [from: number, to: number];
export type Scheme = "light" | "dark";

/** Where each stage holds the sky: dawn is the turn's warmest moment, the sun at the horizon. */
export const SKY_AT = { day: 0, dawn: 0.4, night: 1 } as const;

/** The sky a stage stands under: Input's dawn, Asleep's night, and day over the rest. */
export function skyAtStage(stage: string): number {
  return stage === "input" ? SKY_AT.dawn : stage === "asleep" ? SKY_AT.night : SKY_AT.day;
}

/**
 * How long a turn takes for the whole way, day to night or back (a partial one takes its share),
 * and its one curve. `rise` is dawn's whole way into day when the last ask is answered.
 */
export const SKY_TURN = {
  nightfall: 1100,
  daybreak: 800,
  rise: 1400,
  /** Reduce Motion's crossfade, from anywhere to anywhere. */
  crossfade: 200,
  /** The shortest turn: a tap that only nudges the sky still eases. */
  least: 120,
  easing: [0.37, 0, 0.63, 1] as Bezier,
} as const;

/**
 * Each layer's span of the progress, played forward into night and back into day. At dawn the
 * sun is low and faint, the warmth at its height, and the brightest stars are the last ones out.
 */
export const SKY_SPANS = {
  sunSinks: [0, 0.5],
  sunGoes: [0.2, 0.5],
  sunWarms: [0, 0.3],
  horizon: [0.05, 0.75],
  nightDeepens: [0.1, 0.7],
  cloudsGo: [0.15, 0.6],
  dayLifts: [0.25, 0.9],
  moonRises: [0.55, 0.9],
  moonComes: [0.55, 0.75],
  stars: [
    [0.25, 0.6],
    [0.5, 0.85],
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

/** The horizon's warmth at `p`: none by day or night, at its height at dawn. */
export function warmth(p: number): number {
  "worklet";
  return Math.sin(Math.PI * along(p, SKY_SPANS.horizon));
}

/**
 * The turn from `at` to `to`, or none when the sky stands there. It sets off from where it is and
 * takes its share of the whole way's time: night's pace toward night, day's toward day, or the
 * slower `rise` out of dawn. Under Reduce Motion, one short linear crossfade.
 */
export function skyTurn(
  at: number,
  to: number,
  reduced: boolean,
  rise = false,
): { readonly to: number; readonly ms: number; readonly eased: boolean } | null {
  "worklet";
  const way = Math.abs(to - at);
  if (way === 0) return null;
  if (reduced) return { to, ms: SKY_TURN.crossfade, eased: false };
  const whole =
    to > at ? SKY_TURN.nightfall : rise ? SKY_TURN.rise / SKY_AT.dawn : SKY_TURN.daybreak;
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
  /** The sun's light as it nears the horizon. */
  readonly setting: string;
  readonly moon: string;
  /** The moon's unlit part, a little lighter than the sky it crosses. */
  readonly moonShadow: string;
  /** How strong the sun's and the moon's halo are at their heart. */
  readonly halo: number;
  /** The horizon's warmth, at its height mid-turn. */
  readonly warm: { readonly inner: string; readonly outer: string; readonly peak: number };
  readonly cloud: { readonly colour: string; readonly alpha: number };
  readonly star: string;
  /** The stars' alphas are scaled by this: a light dusk needs them brighter. */
  readonly starLight: number;
  /** The header's ink and the ground under the sky, as the app's theme sets them. */
  readonly ink: string;
  readonly ground: string;
}

export const SKY: Readonly<Record<Scheme, SkyPalette>> = {
  dark: {
    day: { zenith: "#173553", horizon: "#3B6589" },
    night: { zenith: "#04050D", horizon: "#141938" },
    sun: "#FFF4DA",
    setting: "#FF9E7A",
    moon: "#F2EFE6",
    moonShadow: "#1A1D3A",
    halo: 0.22,
    warm: { inner: "#E9845E", outer: "#9E4C7A", peak: 0.42 },
    cloud: { colour: "#FFFFFF", alpha: 0.075 },
    star: "#FFFFFF",
    starLight: 1,
    ink: "#F5F5F5",
    ground: "#0D0D0D",
  },
  light: {
    day: { zenith: "#9EC5EA", horizon: "#D3E6F6" },
    night: { zenith: "#7F89BB", horizon: "#B9BFDF" },
    sun: "#FFFBF0",
    setting: "#FFB08A",
    moon: "#FFFFFF",
    moonShadow: "#6E78AA",
    halo: 0.5,
    warm: { inner: "#F5A27F", outer: "#D98AA8", peak: 0.5 },
    cloud: { colour: "#FFFFFF", alpha: 0.5 },
    star: "#FFFFFF",
    starLight: 2,
    ink: "#27272A",
    ground: "#FCFCFC",
  },
};

/** The sky's shape, in points on the phone and pixels on the Mac. */
export const SKY_SHAPE = {
  /** How far past the first row's top the sky fades out. */
  tail: 20,
  /** The sun and the moon: their radius, how far the sun sinks and the moon rises, the halo's reach in radii. */
  body: { r: 10, sinks: 14, rises: 12, halo: 2.6 },
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

/** Two wisps of cloud: centre across and down the sky's reach, as shares, and their size in points. */
export const CLOUDS = [
  { x: 0.2, y: 0.32, width: 120, height: 14 },
  { x: 0.58, y: 0.62, width: 90, height: 10 },
] as const;
