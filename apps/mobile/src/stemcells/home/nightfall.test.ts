import { describe, expect, it } from "vite-plus/test";

import { DAWN_MS, easeOut, PARTS, shown, turn } from "./nightfall";

describe("night over Settled", () => {
  it.each([
    [0, true, false, { to: 1, ms: 1100, eased: false, notices: true }],
    [1, true, false, null],
    [0, false, false, null],
    [1, false, false, { to: 0, ms: 380, eased: true, notices: false }],
    // Turned back partway, it goes on from there at its own pace, never from the start.
    [0.5, true, false, { to: 1, ms: 550, eased: false, notices: true }],
    [0.75, true, false, { to: 1, ms: 275, eased: false, notices: false }],
    [0.125, false, false, { to: 0, ms: 190, eased: true, notices: false }],
    [0.5, true, true, { to: 1, ms: 100, eased: false, notices: false }],
    [1, false, true, { to: 0, ms: 200, eased: false, notices: false }],
  ])("turns from %s toward night %s (reduced %s)", (at, night, reduced, expected) => {
    expect(turn(at, night, reduced)).toEqual(expected);
  });

  it("is whole by night, and at dawn lets the moon and stars go before the sky", () => {
    const lights = [PARTS.moon, PARTS.glow, ...PARTS.stars];
    for (const part of [PARTS.sky, ...lights]) {
      expect(shown(0, part, false)).toBe(0);
      expect(shown(1, part, false)).toBe(1);
    }
    const dawn = (ms: number) => 1 - easeOut(ms / DAWN_MS);
    expect(Math.max(...lights.map((part) => shown(dawn(180), part, false)))).toBe(0);
    expect(shown(dawn(180), PARTS.sky, false)).toBeGreaterThan(0.5);
  });
});
