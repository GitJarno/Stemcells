/**
 * Where a chart's marks go, as shares of the space a client gives them: which series share a
 * scale, each bar's span, each line's points, the rules behind them and which labels fit. The
 * Mac and the phone draw from this, so a fence reads the same on both
 * (`stemcells/tasks/chart-fence.md`). Hermes runs it: no `toSorted`.
 */
import type { Chart } from "./parse.ts";

export interface Scale {
  readonly min: number;
  readonly max: number;
}

/**
 * The series that share each scale, as indexes into the chart's: all on one when they share a
 * unit, else one small chart per series. Two units never share a chart: its marks would compare
 * what can't be compared.
 */
export function panelsOf(chart: Chart): number[][] {
  const all = chart.series.map((_, index) => index);
  const unit = chart.series[0]?.unit;
  return chart.series.every((series) => series.unit === unit) ? [all] : all.map((index) => [index]);
}

/** A bar's scale always holds zero: a bar's length is its value. */
export function barScale(values: readonly (readonly number[])[]): Scale {
  let min = 0;
  let max = 0;
  for (const series of values) {
    for (const value of series) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return min === max ? { min, max: min + 1 } : { min, max };
}

/** A bar from the zero line to its value, as shares of the track from its start. */
export function barSpan(
  value: number,
  scale: Scale,
): { readonly from: number; readonly to: number } {
  const range = scale.max - scale.min;
  const zero = (0 - scale.min) / range;
  const end = (value - scale.min) / range;
  return { from: Math.min(zero, end), to: Math.max(zero, end) };
}

function rounded(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(value.toFixed(Math.min(decimals, 12)));
}

/**
 * A line's rules at round numbers, the first at or under the least value and the last at or over
 * the greatest: the scale they span. A line need not start at zero.
 */
export function lineTicks(values: readonly (readonly number[])[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const series of values) {
    for (const value of series) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (min > max) return [0, 1];
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.5;
    if (min !== 0) min -= pad;
    max += pad;
  }
  const rough = (max - min) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const share = rough / magnitude;
  const step = (share <= 1 ? 1 : share <= 2 ? 2 : share <= 5 ? 5 : 10) * magnitude;
  const first = Math.floor(min / step);
  const last = Math.ceil(max / step);
  const ticks: number[] = [];
  for (let at = first; at <= last; at += 1) ticks.push(rounded(at * step, step));
  return ticks;
}

/** Each value's place: x across in order, evenly spaced, and y down from the top rule. */
export function pointsOf(
  values: readonly number[],
  ticks: readonly number[],
): { readonly x: number; readonly y: number }[] {
  const min = ticks[0]!;
  const range = ticks[ticks.length - 1]! - min;
  return values.map((value, index) => ({
    x: values.length === 1 ? 0.5 : index / (values.length - 1),
    y: 1 - (value - min) / range,
  }));
}

/** A rule's number: whole thousands apart under 10,000, short (`10K`, `1.5M`) above it. */
export function tickText(value: number, ticks: readonly number[], unit: string): string {
  const step = ticks.length > 1 ? Math.abs(ticks[1]! - ticks[0]!) : 1;
  const top = Math.max(Math.abs(ticks[0]!), Math.abs(ticks[ticks.length - 1]!));
  const suffix = unit === "%" ? "%" : "";
  const [divisor, short] =
    top >= 1e9 ? [1e9, "B"] : top >= 1e6 ? [1e6, "M"] : top >= 1e4 ? [1e3, "K"] : [1, ""];
  const decimals = Math.min(3, Math.max(0, -Math.floor(Math.log10(step / divisor))));
  const [whole, fraction] = Math.abs(value / divisor)
    .toFixed(decimals)
    .split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+$)/g, ",");
  const sign = value < 0 ? "−" : "";
  return `${sign}${grouped}${fraction === undefined ? "" : `.${fraction}`}${short}${suffix}`;
}

/** A character's rough width at the size labels are set in, in px. */
const CHARACTER = 6.2;
const LABEL_GAP = 12;

/**
 * Every how-many-th label fits under a line chart `width` px wide. The first label starts at
 * the plot's edge and the rest are centred, so two neighbours need one and a half labels' room.
 */
export function labelStep(labels: readonly string[], width: number): number {
  if (labels.length < 2 || width <= 0) return 1;
  let widest = 0;
  for (const label of labels) widest = Math.max(widest, label.length);
  const apart = width / (labels.length - 1);
  return Math.max(1, Math.ceil((widest * CHARACTER * 1.5 + LABEL_GAP) / apart));
}

/**
 * Where lines' end labels sit when their lines end close together: each as near its line as
 * the others allow, at least `gap` apart and inside `low` to `high`. In the order given.
 */
export function spread(
  places: readonly number[],
  gap: number,
  low: number,
  high: number,
): number[] {
  const order = places.map((_, index) => index).sort((a, b) => places[a]! - places[b]!);
  const placed = order.map((index) => Math.min(high, Math.max(low, places[index]!)));
  for (let at = 1; at < placed.length; at += 1) {
    placed[at] = Math.max(placed[at]!, placed[at - 1]! + gap);
  }
  const over = placed.length > 0 ? placed[placed.length - 1]! - high : 0;
  if (over > 0) {
    placed[placed.length - 1] = high;
    for (let at = placed.length - 2; at >= 0; at -= 1) {
      placed[at] = Math.min(placed[at]!, placed[at + 1]! - gap);
    }
  }
  const result: number[] = [];
  order.forEach((index, at) => {
    result[index] = placed[at]!;
  });
  return result;
}
