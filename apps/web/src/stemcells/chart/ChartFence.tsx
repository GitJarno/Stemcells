/**
 * A `chart` fence in a reply, drawn (`stemcells/tasks/chart-fence.md`): bars from a zero line
 * with each value beside its bar, or lines over quiet rules, each labelled at its end. Series on
 * different units get a small chart each, never two scales on one. Nothing moves: it is drawn
 * once for its fence's words, and what a hover says the table says too.
 */
import { Fragment, memo, useState, type PointerEvent } from "react";

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
import { parseChart, type Chart } from "../../../../../stemcells/chart/parse.ts";
import { Button, MarkdownTable } from "../upstream/ui";

import "../tokens/stemcells.css";
import "./chart.css";

/** A line chart's plot, in px: fixed, so a reply's height never follows its width. */
const LINE_HEIGHT = 168;
/** The least room between two lines' end labels, in px: a line of their type. */
const END_GAP = 16;
/** The plot's width a narrow chat gives a line chart, and a wide one, in px (`chart.css`). */
const NARROW_PLOT = 216;
const WIDE_PLOT = 456;

// A reply is drawn many times as it streams and as its row comes back into view.
const read = new Map<string, Chart | null>();
function chartOf(source: string): Chart | null {
  let chart = read.get(source);
  if (chart === undefined) {
    if (read.size >= 64) read.clear();
    read.set(source, (chart = parseChart(source)));
  }
  return chart;
}

const share = (part: number) => `${(part * 100).toFixed(3)}%`;
const hue = (series: number) => `var(--sc-data-hue-${series + 1})`;

export const ChartFence = memo(function ChartFence({ source }: { readonly source: string }) {
  const chart = chartOf(source);
  const [asTable, setAsTable] = useState(false);
  if (chart === null) {
    return (
      <pre>
        <code>{source}</code>
      </pre>
    );
  }
  const panels = panelsOf(chart);
  const only = chart.series.length === 1 ? chart.series[0]! : undefined;
  const title = chart.title || only?.header || "";
  return (
    <figure
      data-stemcells-chart={chart.kind}
      aria-label={title || undefined}
      // Copied with the words round it, a chart is its fence (upstream's `markdown-clipboard`).
      data-markdown-copy={`\`\`\`chart\n${source}\n\`\`\`\n\n`}
    >
      <figcaption data-stemcells-chart-head>
        <span data-stemcells-chart-title>
          {title}
          {only !== undefined && chart.title !== "" ? (
            <span data-stemcells-chart-note>{only.header}</span>
          ) : null}
        </span>
        <Button
          type="button"
          variant="ghost-muted"
          size="xs"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? "Chart" : "Table"}
        </Button>
      </figcaption>
      {asTable ? (
        <DataTable chart={chart} />
      ) : (
        <>
          {panels.length === 1 && chart.series.length > 1 ? (
            <div data-stemcells-chart-legend>
              {chart.series.map((series, index) => (
                // oxlint-disable-next-line react/no-array-index-key -- a fence's columns never reorder
                <Key key={index} kind={chart.kind} series={index} words={series.header} />
              ))}
            </div>
          ) : null}
          <div data-stemcells-chart-panels>
            {panels.map((series) => (
              <div key={series[0]} data-stemcells-chart-panel>
                {panels.length > 1 ? (
                  <Key
                    kind={chart.kind}
                    series={series[0]!}
                    words={chart.series[series[0]!]!.header}
                  />
                ) : null}
                {chart.kind === "line" ? (
                  <Lines chart={chart} series={series} />
                ) : (
                  <Bars chart={chart} series={series} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </figure>
  );
});

/** A series' name beside a mark in its hue: the words stay in the text's own ink. */
function Key(props: {
  readonly kind: Chart["kind"];
  readonly series: number;
  readonly words: string;
}) {
  return (
    <span data-stemcells-chart-key>
      <span data-stemcells-chart-swatch={props.kind} style={{ background: hue(props.series) }} />
      {props.words}
    </span>
  );
}

/** What a hover says: every series at the label under the pointer, its value first. */
function Tip(props: {
  readonly chart: Chart;
  readonly series: readonly number[];
  readonly row: number;
  readonly side: "start" | "end";
  readonly at: number;
}) {
  const { chart } = props;
  return (
    <span
      data-stemcells-chart-tip={props.side}
      style={props.side === "start" ? { left: share(props.at) } : { right: share(1 - props.at) }}
    >
      <span data-stemcells-chart-tip-label>{chart.labels[props.row]}</span>
      {props.series.map((index) => (
        <span key={index} data-stemcells-chart-tip-row>
          <span data-stemcells-chart-swatch="line" style={{ background: hue(index) }} />
          <strong>{chart.series[index]!.texts[props.row]}</strong>
          {chart.series[index]!.header}
        </span>
      ))}
    </span>
  );
}

function Bars({ chart, series }: { readonly chart: Chart; readonly series: readonly number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const scale = barScale(series.map((index) => chart.series[index]!.values));
  const over = (event: PointerEvent<HTMLDivElement>) => {
    const row = (event.target as Element).closest("[data-row]")?.getAttribute("data-row");
    setHovered(row == null ? null : Number(row));
  };
  return (
    <div
      data-stemcells-chart-bars={series.length > 1 ? "grouped" : "single"}
      onPointerOver={over}
      onPointerLeave={() => setHovered(null)}
    >
      {chart.labels.map((label, row) => (
        // oxlint-disable-next-line react/no-array-index-key -- a fence's rows never reorder
        <div key={row} data-stemcells-chart-row data-row={row}>
          <span data-stemcells-chart-label style={{ gridRow: `span ${series.length}` }}>
            {label}
          </span>
          {series.map((index, at) => {
            const value = chart.series[index]!.values[row]!;
            const span = barSpan(value, scale);
            return (
              <Fragment key={index}>
                <span data-stemcells-chart-track>
                  <span
                    data-stemcells-chart-bar={value < 0 ? "under" : "over"}
                    style={{
                      left: share(span.from),
                      width: share(span.to - span.from),
                      background: hue(index),
                    }}
                  />
                  {hovered === row && at === 0 ? (
                    <Tip
                      chart={chart}
                      series={series}
                      row={row}
                      side={span.to > 0.5 ? "end" : "start"}
                      at={span.to}
                    />
                  ) : null}
                </span>
                <span data-stemcells-chart-value>{chart.series[index]!.texts[row]}</span>
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Lines({ chart, series }: { readonly chart: Chart; readonly series: readonly number[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const count = chart.labels.length;
  const ticks = lineTicks(series.map((index) => chart.series[index]!.values));
  const unit = chart.series[series[0]!]!.unit;
  const tickWords = ticks.map((tick) => tickText(tick, ticks, unit));
  const lines = series.map((index) => pointsOf(chart.series[index]!.values, ticks));
  const ends = spread(
    lines.map((points) => points[points.length - 1]!.y * LINE_HEIGHT),
    END_GAP,
    0,
    LINE_HEIGHT,
  );
  // One line is named by the title, so its end says its last value; several say their names.
  const endWords = series.map((index) =>
    series.length === 1 ? chart.series[index]!.texts[count - 1]! : chart.series[index]!.name,
  );
  const narrow = labelStep(chart.labels, NARROW_PLOT);
  const wide = labelStep(chart.labels, WIDE_PLOT);
  const nearest = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const across = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
    setHovered(Math.min(count - 1, Math.max(0, Math.round(across * (count - 1)))));
  };
  const hoveredAt = hovered === null ? 0 : lines[0]![hovered]!.x;
  return (
    <div
      data-stemcells-chart-lines
      style={{
        gridTemplateColumns: `${Math.max(...tickWords.map((words) => words.length)) + 1}ch minmax(0, 1fr) ${Math.min(14, Math.max(...endWords.map((words) => words.length))) + 2}ch`,
        gridTemplateRows: `${LINE_HEIGHT}px auto`,
      }}
    >
      <div data-stemcells-chart-ticks aria-hidden>
        {ticks.map((tick, at) => (
          <span key={tick} style={{ top: share(pointsOf([tick], ticks)[0]!.y) }}>
            {tickWords[at]}
          </span>
        ))}
      </div>
      <div
        data-stemcells-chart-plot
        role="img"
        aria-label={`${series.map((index) => chart.series[index]!.header).join(", ")} over ${count} ${chart.labelHeader || "labels"}`}
        onPointerMove={nearest}
        onPointerLeave={() => setHovered(null)}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {ticks.map((tick) => {
            const y = pointsOf([tick], ticks)[0]!.y * 100;
            return <line key={tick} data-stemcells-chart-rule x1={0} x2={100} y1={y} y2={y} />;
          })}
          {lines.map((points, at) => (
            <polyline
              key={series[at]}
              data-stemcells-chart-stroke
              points={points.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
              stroke={hue(series[at]!)}
            />
          ))}
        </svg>
        {hovered === null ? null : (
          <span data-stemcells-chart-cross style={{ left: share(hoveredAt) }} />
        )}
        {lines.map((points, at) => {
          const point = points[hovered ?? count - 1]!;
          return (
            <span
              key={series[at]}
              data-stemcells-chart-dot
              style={{ left: share(point.x), top: share(point.y), background: hue(series[at]!) }}
            />
          );
        })}
        {hovered === null ? null : (
          <Tip
            chart={chart}
            series={series}
            row={hovered}
            side={hoveredAt > 0.5 ? "end" : "start"}
            at={hoveredAt}
          />
        )}
      </div>
      <div data-stemcells-chart-ends aria-hidden>
        {endWords.map((words, at) => (
          <span key={series[at]} style={{ top: ends[at] }}>
            {words}
          </span>
        ))}
      </div>
      <div data-stemcells-chart-labels aria-hidden>
        {chart.labels.map((label, at) =>
          at % narrow === 0 || at % wide === 0 ? (
            <span
              // oxlint-disable-next-line react/no-array-index-key -- a fence's labels never reorder
              key={at}
              data-stemcells-chart-fits={
                at % narrow === 0 ? (at % wide === 0 ? "always" : "narrow") : "wide"
              }
              data-stemcells-chart-edge={at === 0 ? "start" : at === count - 1 ? "end" : undefined}
              style={{ left: share(count === 1 ? 0.5 : at / (count - 1)) }}
            >
              {label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** The same numbers as upstream's own table, which copies as markdown or CSV. */
function DataTable({ chart }: { readonly chart: Chart }) {
  return (
    <MarkdownTable>
      <thead>
        <tr>
          <th>{chart.labelHeader}</th>
          {chart.series.map((series, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- a fence's columns never reorder
            <th key={index}>{series.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {chart.labels.map((label, row) => (
          // oxlint-disable-next-line react/no-array-index-key -- a fence's rows never reorder
          <tr key={row}>
            <td>{label}</td>
            {chart.series.map((series, index) => (
              // oxlint-disable-next-line react/no-array-index-key -- a fence's columns never reorder
              <td key={index}>{series.texts[row]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </MarkdownTable>
  );
}
