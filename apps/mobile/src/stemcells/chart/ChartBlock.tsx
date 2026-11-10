// A `chart` fence in a reply, drawn as the Mac draws it (`stemcells/chart/`, shared): bars from
// a zero line or lines over quiet rules, in the reply's own type. No hover here, so every bar's
// value is printed beside it and a line's end says its last value. Drawn once; nothing moves.
import { useState } from "react";
import { Text, useWindowDimensions, View, type TextStyle } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import {
  barScale,
  barSpan,
  labelStep,
  lineTicks,
  panelsOf,
  pointsOf,
  spread,
  tickText,
} from "../../../../../stemcells/chart/layout.ts";
import type { Chart } from "../../../../../stemcells/chart/parse.ts";
import { DATA_HUES } from "../tokens";

/** The reply's own inks and type, which every word of a chart wears. */
export interface ChartInk {
  readonly color: string;
  readonly strong: string;
  readonly muted: string;
  readonly rule: string;
  readonly fontFamily: string | undefined;
  readonly strongFamily: string | undefined;
  readonly fontSize: number;
}

/** A line chart's plot, in points: the Mac's. */
const LINE_HEIGHT = 168;
/** Room round the plot for a line's end dot, which sits on its edge. */
const PAD = 6;

/** A series' hue by its place: four series at most (`MAX_SERIES`), so none is ever reused. */
const hue = (series: number) => DATA_HUES[series]!;
const longest = (words: readonly string[]) => Math.max(0, ...words.map((word) => word.length));

export function ChartBlock({ chart, ink }: { readonly chart: Chart; readonly ink: ChartInk }) {
  const { fontScale } = useWindowDimensions();
  const panels = panelsOf(chart);
  const only = chart.series.length === 1 ? chart.series[0]! : undefined;
  const title = chart.title || only?.header || "";
  const small: TextStyle = {
    color: ink.muted,
    fontFamily: ink.fontFamily,
    fontSize: ink.fontSize * 0.85,
  };
  return (
    <View style={{ gap: 8 }}>
      {title === "" ? null : (
        <Text style={{ color: ink.strong, fontFamily: ink.strongFamily, fontSize: ink.fontSize }}>
          {title}
          {only !== undefined && chart.title !== "" ? (
            <Text style={small}>{`  ${only.header}`}</Text>
          ) : null}
        </Text>
      )}
      {panels.length === 1 && chart.series.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 4 }}>
          {chart.series.map((series, index) => (
            <Key
              // oxlint-disable-next-line react/no-array-index-key -- a fence's columns never reorder
              key={index}
              series={index}
              words={series.header}
              style={small}
            />
          ))}
        </View>
      ) : null}
      {panels.map((series) => (
        <View key={series[0]} style={{ gap: 8 }}>
          {panels.length > 1 ? (
            <Key series={series[0]!} words={chart.series[series[0]!]!.header} style={small} />
          ) : null}
          {chart.kind === "line" ? (
            <Lines chart={chart} series={series} ink={ink} fontScale={fontScale} />
          ) : (
            <Bars chart={chart} series={series} ink={ink} fontScale={fontScale} />
          )}
        </View>
      ))}
    </View>
  );
}

/** A series' name beside a mark in its hue: the words stay in the text's own ink. */
function Key(props: {
  readonly series: number;
  readonly words: string;
  readonly style: TextStyle;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: hue(props.series) }} />
      <Text style={props.style}>{props.words}</Text>
    </View>
  );
}

interface PanelProps {
  readonly chart: Chart;
  readonly series: readonly number[];
  readonly ink: ChartInk;
  readonly fontScale: number;
}

function Bars({ chart, series, ink, fontScale }: PanelProps) {
  const scale = barScale(series.map((index) => chart.series[index]!.values));
  const grouped = series.length > 1;
  const size = grouped ? ink.fontSize * 0.85 : ink.fontSize;
  // Every row's label and value share a column, so each is as wide as its longest.
  const labelWidth = Math.min(132, longest(chart.labels) * ink.fontSize * 0.56 * fontScale + 4);
  const valueWidth =
    longest(series.flatMap((index) => chart.series[index]!.texts)) * size * 0.62 * fontScale + 4;
  return (
    <View style={{ gap: grouped ? 10 : 8 }}>
      {chart.labels.map((label, row) => (
        <View
          // oxlint-disable-next-line react/no-array-index-key -- a fence's rows never reorder
          key={row}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Text
            style={{
              width: labelWidth,
              color: ink.color,
              fontFamily: ink.fontFamily,
              fontSize: ink.fontSize,
            }}
          >
            {label}
          </Text>
          <View style={{ flex: 1, gap: 2 }}>
            {series.map((index) => {
              const value = chart.series[index]!.values[row]!;
              const span = barSpan(value, scale);
              // Rounded at the value's end, square at the zero line.
              const corners =
                value < 0
                  ? { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }
                  : { borderTopRightRadius: 4, borderBottomRightRadius: 4 };
              return (
                <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, height: grouped ? 6 : 8 }}>
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${span.from * 100}%`,
                        width: `${(span.to - span.from) * 100}%`,
                        backgroundColor: hue(index),
                        ...corners,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      width: valueWidth,
                      textAlign: "right",
                      color: grouped ? ink.color : ink.strong,
                      fontFamily: ink.fontFamily,
                      fontSize: size,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {chart.series[index]!.texts[row]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function Lines({ chart, series, ink, fontScale }: PanelProps) {
  const [width, setWidth] = useState(0);
  const count = chart.labels.length;
  const size = ink.fontSize * 0.85;
  const line = size * 1.3 * fontScale;
  const character = size * 0.62 * fontScale;
  const words: TextStyle = { color: ink.muted, fontFamily: ink.fontFamily, fontSize: size };
  const ticks = lineTicks(series.map((index) => chart.series[index]!.values));
  const tickWords = ticks.map((tick) => tickText(tick, ticks, chart.series[series[0]!]!.unit));
  const lines = series.map((index) => pointsOf(chart.series[index]!.values, ticks));
  // One line is named by the title; several say their names before their last values.
  const endWords = series.map((index) => {
    const last = chart.series[index]!.texts[count - 1]!;
    return series.length === 1 ? last : `${chart.series[index]!.name} ${last}`;
  });
  const axis = longest(tickWords) * character + 8;
  const ends = Math.min(120, longest(endWords) * character + 12);
  const plot = Math.max(0, width - axis - ends);
  const endPlaces = spread(
    lines.map((points) => points[points.length - 1]!.y * LINE_HEIGHT),
    line,
    0,
    LINE_HEIGHT,
  );
  const step = labelStep(chart.labels, plot / fontScale);
  const apart = count > 1 ? plot / (count - 1) : plot;
  const room = Math.max(apart * step, 1);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={series
        .map((index, at) => `${chart.series[index]!.header}: ${endWords[at]}`)
        .join(", ")}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ height: LINE_HEIGHT + PAD * 2 }}>
        {plot > 0 ? (
          <>
            <Svg
              width={plot + PAD * 2}
              height={LINE_HEIGHT + PAD * 2}
              style={{ position: "absolute", left: axis - PAD, top: 0 }}
            >
              {ticks.map((tick) => {
                const y = PAD + pointsOf([tick], ticks)[0]!.y * LINE_HEIGHT;
                return (
                  <Line
                    key={tick}
                    x1={PAD}
                    x2={PAD + plot}
                    y1={y}
                    y2={y}
                    stroke={ink.rule}
                    strokeWidth={1}
                  />
                );
              })}
              {lines.map((points, at) => (
                <Polyline
                  key={series[at]}
                  points={points
                    .map((point) => `${PAD + point.x * plot},${PAD + point.y * LINE_HEIGHT}`)
                    .join(" ")}
                  fill="none"
                  stroke={hue(series[at]!)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {lines.map((points, at) => {
                const last = points[points.length - 1]!;
                return (
                  <Circle
                    key={series[at]}
                    cx={PAD + last.x * plot}
                    cy={PAD + last.y * LINE_HEIGHT}
                    r={4}
                    fill={hue(series[at]!)}
                  />
                );
              })}
            </Svg>
            {ticks.map((tick, at) => (
              <Text
                key={tick}
                numberOfLines={1}
                style={[
                  words,
                  {
                    position: "absolute",
                    left: 0,
                    width: axis - 8,
                    top: PAD + pointsOf([tick], ticks)[0]!.y * LINE_HEIGHT - line / 2,
                    textAlign: "right",
                    fontVariant: ["tabular-nums"],
                  },
                ]}
              >
                {tickWords[at]}
              </Text>
            ))}
            {endWords.map((end, at) => (
              <Text
                key={series[at]}
                numberOfLines={1}
                style={[
                  words,
                  {
                    position: "absolute",
                    left: axis + plot + 10,
                    width: ends - 10,
                    top: PAD + endPlaces[at]! - line / 2,
                    color: ink.color,
                  },
                ]}
              >
                {end}
              </Text>
            ))}
          </>
        ) : null}
      </View>
      <View style={{ height: line, marginLeft: axis, width: plot }}>
        {plot > 0
          ? chart.labels.map((label, at) => {
              if (at % step !== 0) return null;
              const x = count === 1 ? plot / 2 : at * apart;
              // The first label starts at the plot's edge and the last ends at it.
              const edge =
                count === 1 ? "center" : at === 0 ? "left" : at === count - 1 ? "right" : "center";
              const left = edge === "left" ? 0 : edge === "right" ? plot - room : x - room / 2;
              return (
                <Text
                  // oxlint-disable-next-line react/no-array-index-key -- a fence's labels never reorder
                  key={at}
                  numberOfLines={1}
                  style={[words, { position: "absolute", left, width: room, textAlign: edge }]}
                >
                  {label}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}
