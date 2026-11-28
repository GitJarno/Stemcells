import { describe, expect, it } from "vite-plus/test";

import {
  contrast,
  mix,
  nextVisit,
  shootingStarAt,
  shown,
  SKY,
  SKY_AT,
  SKY_SPANS,
  SKY_VISITS,
  skyAtStage,
  skyOver,
  skyStops,
  skyTurn,
} from "./sky";

const steps = Array.from({ length: 101 }, (_, n) => n / 100);
const night = [SKY_SPANS.nightDeepens, SKY_SPANS.moonComes, ...SKY_SPANS.stars];

describe("the sky's turn", () => {
  it.each([
    // Into night and out, whole.
    [0, 1, false, { to: 1, ms: 520, eased: true }],
    [1, 0, false, { to: 0, ms: 420, eased: true }],
    [1, 1, false, null],
    // Turned back partway, it sets off from there and takes its share.
    [0.5, 0, false, { to: 0, ms: 210, eased: true }],
    // A nudge still eases; Reduce Motion crossfades from anywhere.
    [0.02, 0, false, { to: 0, ms: 100, eased: true }],
    [0.5, 1, true, { to: 1, ms: 160, eased: false }],
  ])("turns from %s to %s (reduced %s)", (at, to, reduced, expected) => {
    const turn = skyTurn(at, to, reduced);
    expect(turn === null ? null : { ...turn, ms: Math.round(turn.ms) }).toEqual(expected);
  });

  it("holds night over Asleep and nothing over Input and Awake", () => {
    expect(["needs", "awake", "asleep"].map(skyAtStage)).toEqual([
      SKY_AT.none,
      SKY_AT.none,
      SKY_AT.night,
    ]);
    for (const part of night) {
      expect(shown(SKY_AT.none, part)).toBe(0);
      expect(shown(SKY_AT.night, part)).toBe(1);
    }
  });
});

describe("the sky's look", () => {
  it("fades out to nothing at its foot, so the first row meets the ground at any progress", () => {
    for (const scheme of ["dark", "light"] as const) {
      const gradient = SKY[scheme].night;
      const stops = skyStops(gradient, 0.43);
      expect(stops[0]).toEqual({ offset: 0, colour: gradient.zenith.toLowerCase(), opacity: 1 });
      expect(stops.at(-1)!.opacity).toBe(0);
      stops.slice(1).forEach((stop, n) => {
        expect(stop.offset).toBeGreaterThan(stops[n]!.offset);
        expect(stop.opacity).toBeLessThanOrEqual(stops[n]!.opacity);
      });
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
      const nightHere = skyOver(palette.night, whole, barRow, palette.ground);
      for (const p of steps) {
        const behind = mix(palette.ground, nightHere, shown(p, SKY_SPANS.nightDeepens));
        expect(contrast(palette.ink, behind)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe("the night's shooting stars", () => {
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  it("come seldom, the first sooner", () => {
    const random = seeded(7);
    for (const visit of Array.from({ length: 200 }, () => nextVisit(false, random))) {
      expect(visit.wait).toBeGreaterThanOrEqual(SKY_VISITS.wait[0]);
      expect(visit.wait).toBeLessThanOrEqual(SKY_VISITS.wait[1]);
    }
    expect(nextVisit(true, () => 1).wait).toBe(SKY_VISITS.wait[1] * SKY_VISITS.first);
  });

  it("come and go unseen: invisible at both ends of the crossing", () => {
    const at = (t: number) => shootingStarAt(t, 300, 100);
    expect(at(0).opacity).toBe(0);
    expect(at(1).opacity).toBeCloseTo(0, 9);
    expect(Math.max(...steps.map((t) => at(t).opacity))).toBeCloseTo(1, 1);
  });
});
