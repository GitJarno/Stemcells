import { describe, expect, it } from "vite-plus/test";

import {
  contrast,
  mix,
  shown,
  SKY,
  SKY_AT,
  SKY_SPANS,
  skyAtStage,
  skyOver,
  skyStops,
  skyTurn,
  warmth,
} from "./sky";

const steps = Array.from({ length: 101 }, (_, n) => n / 100);
const bodies = [SKY_SPANS.sunGoes, SKY_SPANS.moonComes] as const;
const night = [SKY_SPANS.nightDeepens, SKY_SPANS.moonComes, ...SKY_SPANS.stars];
const day = [SKY_SPANS.dayLifts, SKY_SPANS.sunGoes, SKY_SPANS.cloudsGo];

describe("the sky's turn", () => {
  it.each([
    // Day to night and back, whole.
    [0, 1, false, false, { to: 1, ms: 1100, eased: true }],
    [1, 0, false, false, { to: 0, ms: 800, eased: true }],
    [1, 1, false, false, null],
    // Dawn to day and to night take their share; turned back partway, it sets off from there.
    [0.4, 0, false, false, { to: 0, ms: 320, eased: true }],
    [0.4, 1, false, false, { to: 1, ms: 660, eased: true }],
    [0.7, 0.4, false, false, { to: 0.4, ms: 240, eased: true }],
    // The last ask answered: dawn rises into day, slower; from partway, its share.
    [0.4, 0, false, true, { to: 0, ms: 1400, eased: true }],
    [0.2, 0, false, true, { to: 0, ms: 700, eased: true }],
    // A nudge still eases; Reduce Motion crossfades from anywhere.
    [0.02, 0, false, false, { to: 0, ms: 120, eased: true }],
    [0.5, 1, true, false, { to: 1, ms: 200, eased: false }],
  ])("turns from %s to %s (reduced %s, rise %s)", (at, to, reduced, rise, expected) => {
    const turn = skyTurn(at, to, reduced, rise);
    expect(turn === null ? null : { ...turn, ms: Math.round(turn.ms) }).toEqual(expected);
  });

  it("holds each stage's sky: Input at dawn, Awake by day, Asleep at night", () => {
    expect(["input", "awake", "asleep"].map(skyAtStage)).toEqual([
      SKY_AT.dawn,
      SKY_AT.day,
      SKY_AT.night,
    ]);
    for (const part of [...night, ...day]) {
      expect(shown(SKY_AT.day, part)).toBe(0);
      expect(shown(SKY_AT.night, part)).toBe(1);
    }
    expect(warmth(SKY_AT.day)).toBe(0);
    expect(warmth(SKY_AT.night)).toBeCloseTo(0, 12);
  });

  it("dawns with the sun low and faint, the horizon warm and only the brightest stars", () => {
    const p = SKY_AT.dawn;
    const sun = 1 - shown(p, SKY_SPANS.sunGoes);
    expect(sun).toBeGreaterThan(0);
    expect(sun).toBeLessThan(0.5);
    expect(shown(p, SKY_SPANS.sunSinks)).toBeGreaterThan(0.8);
    expect(warmth(p)).toBeGreaterThan(0.9);
    const [brightest, ...rest] = SKY_SPANS.stars;
    expect(shown(p, brightest)).toBeGreaterThan(0.2);
    expect(shown(p, brightest)).toBeLessThan(0.6);
    for (const stars of rest) expect(shown(p, stars)).toBe(0);
    expect(shown(p, SKY_SPANS.moonComes)).toBe(0);
  });

  it("never lets the ground show through the two skies mid-turn", () => {
    for (const p of steps) {
      const dayLeft = 1 - shown(p, SKY_SPANS.dayLifts);
      const nightIn = shown(p, SKY_SPANS.nightDeepens);
      expect(1 - (1 - dayLeft) * (1 - nightIn)).toBeGreaterThan(0.9);
    }
  });

  it("never shows the sun and the moon together", () => {
    for (const p of steps) expect(Math.min(1 - shown(p, bodies[0]), shown(p, bodies[1]))).toBe(0);
  });
});

describe("the sky's look", () => {
  it("fades out to nothing at its foot, so the first row meets the ground at any progress", () => {
    for (const scheme of ["dark", "light"] as const) {
      for (const gradient of [SKY[scheme].day, SKY[scheme].night]) {
        const stops = skyStops(gradient, 0.43);
        expect(stops[0]).toEqual({ offset: 0, colour: gradient.zenith.toLowerCase(), opacity: 1 });
        expect(stops.at(-1)!.opacity).toBe(0);
        stops.slice(1).forEach((stop, n) => {
          expect(stop.offset).toBeGreaterThan(stops[n]!.offset);
          expect(stop.opacity).toBeLessThanOrEqual(stops[n]!.opacity);
        });
      }
    }
  });

  // The phone's bar row, its centre: the bar's foot at 116 pt, then 8 pt and the tail; whole for
  // half the way to the foot (`home/Sky.tsx`).
  const foot = 116;
  const height = foot + 8 + 20;
  const whole = foot / 2 / height;
  const barRow = (foot - 26) / height;

  it.each(["dark", "light"] as const)(
    "keeps the header's ink legible over the bar row through the turn (%s)",
    (scheme) => {
      const palette = SKY[scheme];
      const at = (gradient: typeof palette.day) => skyOver(gradient, whole, barRow, palette.ground);
      const dayHere = at(palette.day);
      const nightHere = at(palette.night);
      for (const p of steps) {
        const behind = mix(
          mix(palette.ground, dayHere, 1 - shown(p, SKY_SPANS.dayLifts)),
          nightHere,
          shown(p, SKY_SPANS.nightDeepens),
        );
        expect(contrast(palette.ink, behind)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
