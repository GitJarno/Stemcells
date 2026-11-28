/**
 * The sky behind the phone's header and the column's head (stemcells/tasks/day-night.md): night
 * over Asleep, and none over Input and Awake. Plain numbers and colours, so the phone reads them
 * too (`line/kit.ts`). One progress, 0 none to 1 night, drives every layer. The phone runs these
 * on its UI thread, hence the worklets.
 */

import type { Bezier } from "./listMotion";

export type Span = readonly [from: number, to: number];
export type Scheme = "light" | "dark";

export const SKY_AT = { none: 0, night: 1 } as const;

/** The sky a stage stands under: Asleep's night, and none over the rest. */
export function skyAtStage(stage: string): number {
  return stage === "asleep" ? SKY_AT.night : SKY_AT.none;
}

/**
 * How long a turn takes for the whole way, into night or out of it (a partial one takes its share),
 * and its one curve: it decelerates, so the sky answers in the switch's own frame and settles.
 */
export const SKY_TURN = {
  falls: 520,
  lifts: 420,
  /** Reduce Motion's crossfade, from anywhere to anywhere. */
  crossfade: 160,
  /** The shortest turn: a nudge still eases. */
  least: 100,
  easing: [0.2, 0, 0, 1] as Bezier,
} as const;

/**
 * Each layer's span of the progress, played forward into night and back out of it: the sky first,
 * then the moon rising into it and the stars coming out, brightest first.
 */
export const SKY_SPANS = {
  nightDeepens: [0, 0.6],
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
  const whole = to > at ? SKY_TURN.falls : SKY_TURN.lifts;
  return { to, ms: Math.max(SKY_TURN.least, whole * way), eased: true };
}

interface Gradient {
  readonly zenith: string;
  readonly horizon: string;
}

export interface SkyPalette {
  readonly night: Gradient;
  readonly moon: string;
  /** The moon's unlit part, a little lighter than the sky it crosses. */
  readonly moonShadow: string;
  /** How strong the moon's halo is at its heart. */
  readonly halo: number;
  readonly star: string;
  /** The stars' alphas are scaled by this: a light night needs them brighter. */
  readonly starLight: number;
  /** The header's ink and the ground under the sky, as the app's theme sets them. */
  readonly ink: string;
  readonly ground: string;
}

/** Night: a deep indigo, the moon at tonight's phase and the stars. */
export const SKY: Readonly<Record<Scheme, SkyPalette>> = {
  dark: {
    night: { zenith: "#04050D", horizon: "#141938" },
    moon: "#F2EFE6",
    moonShadow: "#1A1D3A",
    halo: 0.14,
    star: "#FFFFFF",
    starLight: 1,
    ink: "#F5F5F5",
    ground: "#0D0D0D",
  },
  light: {
    night: { zenith: "#7F89BB", horizon: "#B9BFDF" },
    moon: "#FFFFFF",
    moonShadow: "#6E78AA",
    halo: 0.5,
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
  /** The moon: its radius, how far it rises, its halo's reach in radii. */
  body: { r: 10, rises: 6, halo: 2.6 },
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

/**
 * Now and then a shooting star crosses the night, and between them nothing moves. Seldom, small
 * and soft at both ends, so it rewards a glance without drawing one; never under Reduce Motion,
 * and only while the night is on screen.
 */
export const SKY_VISITS = {
  /** The wait between shooting stars, least to most, in ms. */
  wait: [14_000, 34_000],
  /** The first comes sooner once night has fallen: this share of a wait. */
  first: 0.3,
  /** How long one takes to cross, in ms. */
  ms: 900,
} as const;

export interface SkyVisit {
  readonly wait: number;
  /** Where it sets off, across the sky and down the stars' reach, as shares. */
  readonly x: number;
  readonly y: number;
}

/** The next shooting star; `first`, the first since night fell. */
export function nextVisit(first: boolean, random: () => number): SkyVisit {
  const [least, most] = SKY_VISITS.wait;
  const wait = (least + random() * (most - least)) * (first ? SKY_VISITS.first : 1);
  return { wait, x: random() * 0.35, y: 0.04 + random() * 0.26 };
}

/** Where a shooting star is, `t` of the way through its crossing: points from where it set off. */
export interface Pose {
  readonly x: number;
  readonly y: number;
  /** Degrees. */
  readonly rotate: number;
  readonly opacity: number;
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
