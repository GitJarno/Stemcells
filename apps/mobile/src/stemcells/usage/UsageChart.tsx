// The usage screen's chart, as the Mac draws it (`chart.ts`): a smoothed line per provider over
// a faint fill of its colour, the biggest at the back. As the original app's phone draws it: no numbers
// up the side, hairline rules at thirds (a ruler, not a scale), and the peak said to a screen
// reader. Drawn once; nothing on it moves.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import {
  formatDayShort,
  formatHourShort,
  formatTokens,
  formatUsd,
  type UsageChartMetric,
  type UsageDailyChartProps,
} from "../upstream/usage";
import { pathsOf, peakOf, type ProviderSeries, seriesOf } from "./chart";
import { useCellProviderColours } from "./colours";

const STROKE = 2;
/** The Mac's fill under each line. */
const FILL_OPACITY = 0.12;

export function UsageDailyChart({ days, daily, metric, height }: UsageDailyChartProps) {
  const colours = useCellProviderColours();
  const rule = useResolveClassNames("bg-border").backgroundColor;
  const [width, setWidth] = useState(0);
  const inset = STROKE / 2;
  const series = seriesOf(days, daily, metric);
  const paths = pathsOf(series, width, height, inset);
  const rules = [0, 1, 2, 3].map((third) => inset + (third * (height - 2 * inset)) / 3);
  return (
    <View
      style={{ height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={peakWords(days, series, metric)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {rules.map((y) => (
            <Line
              key={y}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke={rule}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}
          {paths.map(({ provider, area }) => (
            <Path key={provider} d={area} fill={colours[provider]} fillOpacity={FILL_OPACITY} />
          ))}
          {paths.map(({ provider, line }) => (
            <Path
              key={provider}
              d={line}
              fill="none"
              stroke={colours[provider]}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function peakWords(
  periods: readonly string[],
  series: readonly ProviderSeries[],
  metric: UsageChartMetric,
): string {
  const peak = peakOf(series);
  const period = peak === null ? undefined : periods[peak.index];
  if (peak === null || period === undefined) {
    return metric === "cost" ? "No cost in this window" : "No tokens in this window";
  }
  const value = metric === "cost" ? formatUsd(peak.value) : `${formatTokens(peak.value)} tokens`;
  // An hour's period is an instant (`…T13:00:00.000Z`), a day's a date.
  return period.includes("T")
    ? `Peak ${value} at ${formatHourShort(period)}`
    : `Peak ${value} on ${formatDayShort(period)}`;
}
