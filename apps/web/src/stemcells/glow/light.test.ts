import { describe, expect, it } from "vite-plus/test";

import { crossing } from "../motion/beat";
import { CELL_STATUSES } from "../upstream/status";
import {
  axial,
  bandReach,
  bandStops,
  bandWidth,
  glowOf,
  imprintShows,
  imprintSide,
  irisRadius,
  LIGHT,
  luminanceOf,
  type Rgb,
  sheenTone,
  strength,
  toneTokenOf,
  variant,
  washEnds,
} from "./light";

const CLAUDE: Rgb = [217, 119, 87];
const CODEX: Rgb = [16, 163, 127];
const PALE: Rgb = [250, 220, 200];
const DARK_GLASS: Rgb = [26, 26, 26];
const LIGHT_GLASS: Rgb = [255, 255, 255];

const alphaOf = (colour: string) => Number(/rgba\([^)]*,\s*([\d.]+)\)$/.exec(colour)![1]);
const rgbOf = (colour: string): Rgb =>
  /rgba\((\d+), (\d+), (\d+)/.exec(colour)!.slice(1, 4).map(Number) as unknown as Rgb;
const over = (top: Rgb, alpha: number, ground: Rgb): Rgb =>
  [0, 1, 2].map((c) => alpha * top[c]! + (1 - alpha) * ground[c]!) as unknown as Rgb;
/** The glass under the band: the wash's middle over the glass. */
const washed = (tone: Rgb, glass: Rgb) => over(tone, 0.08, glass);

describe("what the glass says", () => {
  it("works while a turn is in flight, on its way, or held by background work", () => {
    expect(["Working", "Connecting", "Waiting"].map((s) => glowOf(s as never))).toEqual([
      "working",
      "working",
      "working",
    ]);
  });

  it("asks while the Cell is blocked on you", () => {
    for (const status of ["Pending Approval", "Awaiting Input", "Plan Ready"] as const) {
      expect(glowOf(status)).toBe("needsYou");
    }
  });

  it("is plain glass when it is your turn, and for a draft", () => {
    expect(glowOf("Completed")).toBe("quiet");
    expect(glowOf("Failed")).toBe("quiet");
    expect(glowOf(null)).toBe("quiet");
  });

  it("names a state for every status upstream shows", () => {
    for (const status of CELL_STATUSES) expect(glowOf(status)).toMatch(/quiet|working|needsYou/);
  });

  it("wears the provider's brand, and the accent for a provider without one", () => {
    expect(toneTokenOf("claudeAgent")).toBe("--sc-provider-claude");
    expect(toneTokenOf("codex")).toBe("--sc-provider-codex");
    expect(toneTokenOf("opencode")).toBe("--sc-accent");
    expect(toneTokenOf(null)).toBe("--sc-accent");
  });
});

describe("the light's colours", () => {
  it("keeps every colour in the tone's family: a turn moves the hue, a lift moves toward white", () => {
    expect(rgbOf(variant(CLAUDE, 0, 0, 1))).toEqual(CLAUDE);
    expect(rgbOf(variant(CLAUDE, 0, 1, 1))).toEqual([255, 255, 255]);
    expect(rgbOf(variant([128, 128, 128], 0.3, 0.5, 1))).toEqual([192, 192, 192]);
    expect(rgbOf(variant(CLAUDE, 0.02, 0, 1))).not.toEqual(CLAUDE);
  });

  it("draws the band so its core adds the light the words allow to dark glass", () => {
    const alpha = strength(CLAUDE, DARK_GLASS, true);
    const ground = washed(CLAUDE, DARK_GLASS);
    const crest = luminanceOf(over(CLAUDE, alpha, ground));
    expect(crest - luminanceOf(ground)).toBeCloseTo(LIGHT, 3);
  });

  it("draws a pale tone thinner than a deep one, to add the same light", () => {
    expect(strength(PALE, DARK_GLASS, true)).toBeLessThan(strength(CODEX, DARK_GLASS, true));
  });

  it("on light glass shades it instead, by the same share of the words' contrast", () => {
    const alpha = strength(CLAUDE, LIGHT_GLASS, false);
    const ground = washed(CLAUDE, LIGHT_GLASS);
    expect(alpha).toBeGreaterThan(strength(CLAUDE, DARK_GLASS, true));
    expect(alpha).toBeLessThanOrEqual(0.8);
    expect(luminanceOf(over(CLAUDE, alpha, ground))).toBeLessThan(luminanceOf(ground));
  });

  it("never draws the band past 0.8, however faint the tone over the glass", () => {
    expect(strength([30, 30, 30], DARK_GLASS, true)).toBe(0.8);
  });

  it("fades the band in and out from clear, its core at full strength", () => {
    const stops = bandStops(CLAUDE, 0.3);
    expect(stops).toHaveLength(13);
    expect(alphaOf(stops[0]!.replace(/ [\d.]+%$/, ""))).toBe(0);
    expect(alphaOf(stops[12]!.replace(/ [\d.]+%$/, ""))).toBe(0);
    expect(alphaOf(stops[6]!.replace(/ [\d.]+%$/, ""))).toBeCloseTo(0.3, 4);
  });

  it("lifts the sheen to the interface ink's lightness on dark glass, and leaves a tone already lighter", () => {
    const lifted = sheenTone(CODEX, [200, 200, 200]);
    expect(luminanceOf(lifted)).toBeGreaterThan(luminanceOf(CODEX));
    expect(sheenTone(CLAUDE, [60, 60, 60])).toEqual(CLAUDE);
  });
});

describe("the light's geometry", () => {
  const size = { width: 600, height: 120 };
  const anchor = { x: 568, y: 88 };

  it("makes the band half the glass, and no narrower than a folded pill's", () => {
    expect(bandWidth(size)).toBe(300);
    expect(bandWidth({ width: 40, height: 30 })).toBe(36);
  });

  it("waits clear of the glass, its lean included, while the pane's crest is out past either edge", () => {
    // The worst case: glass flush with both edges of its pane.
    for (const glass of [size, { width: 2000, height: 120 }, { width: 900, height: 600 }]) {
      const { from, to } = crossing(glass.width, 0, bandWidth(glass) / 2);
      const middle = (x: number) => x + bandWidth(glass) / 2;
      expect(middle(from) + bandReach(glass)).toBeLessThanOrEqual(1e-9);
      expect(middle(to) - bandReach(glass)).toBeGreaterThanOrEqual(glass.width - 1e-9);
    }
  });

  it("opens the iris solid past the glass's far corner", () => {
    expect(irisRadius(size, anchor) * 0.78).toBeGreaterThan(Math.hypot(anchor.x, anchor.y));
  });

  it("runs the wash from the send button to the far corner, and drifts its far end round to the button's height", () => {
    const ends = washEnds(size, anchor);
    expect(ends.far.x).toBeCloseTo(32);
    expect(ends.far.y).toBeCloseTo(32);
    expect(ends.drift.x).toBeCloseTo(32);
    expect(ends.drift.y).toBeGreaterThan(size.height / 2);
    expect(ends.drift.y).toBeLessThan(anchor.y);
  });

  it("puts an axial gradient's colours on the points it runs between", () => {
    expect(
      axial(size, { x: 0, y: 60 }, { x: 600, y: 60 }, [
        ["red", 0],
        ["blue", 1],
      ]),
    ).toBe("linear-gradient(90deg, red 0px, blue 600px)");
    expect(
      axial(size, { x: 600, y: 60 }, { x: 0, y: 60 }, [
        ["red", 0],
        ["blue", 1],
      ]),
    ).toBe("linear-gradient(-90deg, red 0px, blue 600px)");
    expect(
      axial(size, { x: 300, y: 0 }, { x: 300, y: 120 }, [
        ["red", 0],
        ["blue", 0.5],
      ]),
    ).toBe("linear-gradient(180deg, red 0px, blue 60px)");
  });
});

describe("the provider's imprint", () => {
  it("grows with the glass up to a cap", () => {
    expect(imprintSide({ width: 2000, height: 400 })).toBe(150);
    expect(imprintSide({ width: 200, height: 400 })).toBe(80);
    expect(imprintSide({ width: 2000, height: 60 })).toBe(90);
  });

  it("shows only when its middle stands clear of the send button", () => {
    expect(imprintShows({ width: 700, height: 160 }, 48)).toBe(true);
    expect(imprintShows({ width: 700, height: 60 }, 48)).toBe(false);
  });
});
