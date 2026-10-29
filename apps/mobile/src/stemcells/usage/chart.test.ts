import { describe, expect, it } from "vite-plus/test";

import type { DailyTotals, UsageProviderKind } from "../upstream/usage";
import { curvePath, pathsOf, peakOf, seriesOf } from "./chart";

const day = (
  date: string,
  spend: Partial<Record<UsageProviderKind, readonly [cost: number, tokens: number]>>,
): DailyTotals => {
  const byProvider = new Map(
    Object.entries(spend).map(([provider, [costUsd, totalTokens]]) => [
      provider as UsageProviderKind,
      { costUsd, totalTokens },
    ]),
  );
  return { day: date, costUsd: 0, totalTokens: 0, byProvider };
};

const periods = ["2026-10-01", "2026-10-02", "2026-10-03"];
const totals = [
  day("2026-10-01", { claude: [1, 900], codex: [4, 100], cursor: [0, 0] }),
  day("2026-10-03", { claude: [2, 800] }),
];

/** Every number a path names, in order. */
const numbersOf = (path: string) => [...path.matchAll(/-?[\d.]+/g)].map(([n]) => Number(n));

describe("the usage chart's shapes", () => {
  it("a line per provider with any of the metric, zero where it has none, biggest first", () => {
    expect(seriesOf(periods, totals, "cost")).toEqual([
      { provider: "codex", values: [4, 0, 0], total: 4 },
      { provider: "claude", values: [1, 0, 2], total: 3 },
    ]);
    expect(seriesOf(periods, totals, "tokens").map((series) => series.provider)).toEqual([
      "claude",
      "codex",
    ]);
    expect(seriesOf(periods, [], "cost")).toEqual([]);
  });

  it("the peak is the period the providers spent the most in together", () => {
    expect(peakOf(seriesOf(periods, totals, "cost"))).toEqual({ index: 0, value: 5 });
    expect(peakOf(seriesOf(periods, totals, "tokens"))).toEqual({ index: 0, value: 1000 });
    expect(peakOf([])).toBeNull();
  });

  it("the highest single value meets the top, zero the bottom, each inset by the stroke", () => {
    const [codex, claude] = pathsOf(seriesOf(periods, totals, "cost"), 200, 100, 1);
    expect(codex!.line.startsWith("M0,1 ")).toBe(true);
    expect(codex!.line.endsWith(" 200,99")).toBe(true);
    expect(claude!.line.startsWith("M0,74.5 ")).toBe(true);
    expect(claude!.area.endsWith(" L200,99 L0,99 Z")).toBe(true);
  });

  it("a curve never swings past the values either side of a span", () => {
    const points = [0, 30, 30, 100, 0, 5].map((y, index) => ({ x: index * 10, y }));
    const numbers = numbersOf(curvePath(points));
    const ys = numbers.filter((_, index) => index % 2 === 1);
    // M x,y, then three points a span: two controls and the end.
    for (let span = 0; span < points.length - 1; span++) {
      const [from, to] = [points[span]!.y, points[span + 1]!.y];
      const controls = ys.slice(1 + span * 3, 3 + span * 3);
      for (const y of controls) {
        expect(y).toBeGreaterThanOrEqual(Math.min(from, to));
        expect(y).toBeLessThanOrEqual(Math.max(from, to));
      }
    }
    expect(curvePath([])).toBe("");
    expect(curvePath([{ x: 0, y: 5 }])).toBe("M0,5");
  });
});
