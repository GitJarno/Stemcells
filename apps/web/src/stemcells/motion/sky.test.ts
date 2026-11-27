import { describe, expect, it } from "vite-plus/test";

import { contrast, mix, shown, SKY, SKY_SPANS, skyOver, skyStops, skyTurn, warmth } from "./sky";

const steps = Array.from({ length: 101 }, (_, n) => n / 100);
const bodies = [SKY_SPANS.sunGoes, SKY_SPANS.moonComes] as const;
const night = [SKY_SPANS.nightDeepens, SKY_SPANS.moonComes, ...SKY_SPANS.stars];
const day = [SKY_SPANS.dayLifts, SKY_SPANS.sunGoes, SKY_SPANS.cloudsGo];

describe("the sky's turn", () => {
  it.each([
    [0, true, false, { to: 1, ms: 1100, eased: true }],
    [1, true, false, null],
    [0, false, false, null],
    [1, false, false, { to: 0, ms: 800, eased: true }],
    // Turned back partway, it sets off from there and takes its share of the time.
    [0.5, true, false, { to: 1, ms: 550, eased: true }],
    [0.25, false, false, { to: 0, ms: 200, eased: true }],
    // A nudge still eases.
    [0.02, false, false, { to: 0, ms: 120, eased: true }],
    [0.5, true, true, { to: 1, ms: 100, eased: false }],
    [1, false, true, { to: 0, ms: 200, eased: false }],
  ])("turns from %s toward night %s (reduced %s)", (at, toNight, reduced, expected) => {
    expect(skyTurn(at, toNight, reduced)).toEqual(expected);
  });

  it("is all day at 0 and all night at 1", () => {
    for (const part of [...night, ...day]) {
      expect(shown(0, part, false)).toBe(0);
      expect(shown(1, part, false)).toBe(1);
    }
    expect(warmth(0, false)).toBe(0);
    expect(warmth(1, false)).toBeCloseTo(0, 12);
  });

  it("never lets the ground show through the two skies mid-turn", () => {
    for (const p of steps) {
      const dayLeft = 1 - shown(p, SKY_SPANS.dayLifts, false);
      const nightIn = shown(p, SKY_SPANS.nightDeepens, false);
      expect(1 - (1 - dayLeft) * (1 - nightIn)).toBeGreaterThan(0.9);
    }
  });

  it("shows one body at a time, and at daybreak lets the stars go before the sun comes", () => {
    for (const p of steps) {
      const sun = 1 - shown(p, bodies[0], false);
      const moon = shown(p, bodies[1], false);
      expect(Math.min(sun, moon)).toBe(0);
      if (sun > 0) for (const stars of SKY_SPANS.stars) expect(shown(p, stars, false)).toBe(0);
    }
  });

  it("warms the horizon only mid-turn, and not under Reduce Motion", () => {
    const peak = steps.reduce((best, p) => (warmth(p, false) > warmth(best, false) ? p : best));
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThan(0.55);
    expect(Math.max(...steps.map((p) => warmth(p, true)))).toBe(0);
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
          mix(palette.ground, dayHere, 1 - shown(p, SKY_SPANS.dayLifts, false)),
          nightHere,
          shown(p, SKY_SPANS.nightDeepens, false),
        );
        expect(contrast(palette.ink, behind)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
