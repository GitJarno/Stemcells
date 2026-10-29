// The usage chart's shapes, as the Mac draws them (`apps/web/src/components/usage/
// UsageProviderChart.tsx`, whose helpers upstream keeps to itself): a line per provider through
// each period's value, absolute, not stacked, smoothed as a monotone cubic so it never swings
// past the values either side of it (no dip under zero, no false peak).
import type { DailyTotals, UsageChartMetric, UsageProviderKind } from "../upstream/usage";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ProviderSeries {
  readonly provider: UsageProviderKind;
  /** A value each period, in the periods' order. */
  readonly values: readonly number[];
  readonly total: number;
}

export interface ProviderPath {
  readonly provider: UsageProviderKind;
  readonly line: string;
  /** The line closed down to zero: what its fill covers. */
  readonly area: string;
}

/** Each provider with any `metric` in `periods`, the biggest first: it's drawn at the back. */
export function seriesOf(
  periods: readonly string[],
  totals: readonly DailyTotals[],
  metric: UsageChartMetric,
): readonly ProviderSeries[] {
  const byPeriod = new Map(totals.map((entry) => [entry.day, entry]));
  const rows = new Map<UsageProviderKind, number[]>();
  periods.forEach((period, index) => {
    for (const [provider, entry] of byPeriod.get(period)?.byProvider ?? []) {
      const row = rows.get(provider) ?? periods.map(() => 0);
      row[index] = metric === "cost" ? entry.costUsd : entry.totalTokens;
      rows.set(provider, row);
    }
  });
  // Hermes lacks toSorted.
  return [...rows]
    .map(([provider, values]) => ({
      provider,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    }))
    .filter((series) => series.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** The period the providers spent the most in together, or `null` when they spent nothing. */
export function peakOf(
  series: readonly ProviderSeries[],
): { readonly index: number; readonly value: number } | null {
  let peak: { index: number; value: number } | null = null;
  const periods = series[0]?.values.length ?? 0;
  for (let index = 0; index < periods; index++) {
    const value = series.reduce((sum, line) => sum + (line.values[index] ?? 0), 0);
    if (value > (peak?.value ?? 0)) peak = { index, value };
  }
  return peak;
}

/**
 * Each series across `width`, its highest value `inset` under the top and zero `inset` over the
 * bottom, so a 2 × `inset` stroke is never cut. The scale is the highest single value: the
 * lines aren't stacked, so a sum of peaks would waste the height.
 */
export function pathsOf(
  series: readonly ProviderSeries[],
  width: number,
  height: number,
  inset: number,
): readonly ProviderPath[] {
  const max = series.reduce((peak, line) => Math.max(peak, ...line.values), 0);
  const bottom = height - inset;
  const yOf = (value: number) => (max === 0 ? bottom : bottom - (value / max) * (bottom - inset));
  return series.map(({ provider, values }) => {
    const xOf = (index: number) => (values.length < 2 ? 0 : (index * width) / (values.length - 1));
    const line = curvePath(values.map((value, index) => ({ x: xOf(index), y: yOf(value) })));
    const area =
      line === ""
        ? ""
        : `${line} L${round(xOf(values.length - 1))},${round(bottom)} L0,${round(bottom)} Z`;
    return { provider, line, area };
  });
}

/** An SVG path through `points`, a cubic each span. */
export function curvePath(points: readonly Point[]): string {
  const tangents = tangentsOf(points);
  return points
    .map((point, index) => {
      const at = `${round(point.x)},${round(point.y)}`;
      const from = points[index - 1];
      if (from === undefined) return `M${at}`;
      const third = (point.x - from.x) / 3;
      const c1 = `${round(from.x + third)},${round(from.y + tangents[index - 1]! * third)}`;
      const c2 = `${round(point.x - third)},${round(point.y - tangents[index]! * third)}`;
      return `C${c1} ${c2} ${at}`;
    })
    .join(" ");
}

/** Fritsch–Carlson: flat where the values turn or hold, eased where a curve would overshoot. */
function tangentsOf(points: readonly Point[]): number[] {
  const slopes = points.slice(1).map((point, index) => {
    const from = points[index]!;
    const dx = point.x - from.x;
    return dx === 0 ? 0 : (point.y - from.y) / dx;
  });
  const tangents = points.map((_, index) => {
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === undefined) return after ?? 0;
    if (after === undefined) return before;
    return before * after <= 0 ? 0 : (before + after) / 2;
  });
  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }
    const a = tangents[index]! / slope;
    const b = tangents[index + 1]! / slope;
    const magnitude = a * a + b * b;
    if (magnitude <= 9) return;
    const scale = 3 / Math.sqrt(magnitude);
    tangents[index] = scale * a * slope;
    tangents[index + 1] = scale * b * slope;
  });
  return tangents;
}

const round = (value: number) => String(Math.round(value * 100) / 100);
