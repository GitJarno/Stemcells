import { describe, expect, it } from "vite-plus/test";

import {
  barScale,
  barSpan,
  labelStep,
  lineTicks,
  panelsOf,
  pointsOf,
  spread,
  tickText,
} from "./layout.ts";
import { parseChart } from "./parse.ts";

const chartOf = (head: string, row: string) =>
  parseChart([head, head.replace(/[^|]+/g, " --- "), row].join("\n"))!;

describe("which series share a scale", () => {
  it.each([
    ["one series", "| A | Time (ms) |", "| x | 1 |", [[0]]],
    ["one unit", "| A | Cold (ms) | Warm (ms) |", "| x | 1 | 2 |", [[0, 1]]],
    ["no unit at all", "| A | B | C | D |", "| x | 1 | 2 | 3 |", [[0, 1, 2]]],
    ["two units", "| A | Time (ms) | Size (MB) |", "| x | 1 | 2 |", [[0], [1]]],
    ["a unit and none", "| A | Share | Count |", "| x | 5% | 2 |", [[0], [1]]],
  ])("%s", (_name, head, row, panels) => {
    expect(panelsOf(chartOf(head, row))).toEqual(panels);
  });
});

describe("a bar's span", () => {
  it("runs from zero, however far the least value is from it", () => {
    const scale = barScale([[40, 50]]);
    expect(scale).toEqual({ min: 0, max: 50 });
    expect(barSpan(40, scale)).toEqual({ from: 0, to: 0.8 });
  });

  it("runs back from the zero line for a value under it", () => {
    const scale = barScale([[-10, 30]]);
    expect(barSpan(-10, scale)).toEqual({ from: 0, to: 0.25 });
    expect(barSpan(30, scale)).toEqual({ from: 0.25, to: 1 });
  });

  it("has a scale when every value is zero", () => {
    expect(barSpan(0, barScale([[0, 0]]))).toEqual({ from: 0, to: 0 });
  });
});

describe("a line's rules", () => {
  it.each([
    ["need not start at zero", [[102, 118, 131]], [100, 110, 120, 130, 140]],
    ["cross zero", [[-4, 9]], [-5, 0, 5, 10]],
    ["hold fractions", [[0.12, 0.31]], [0.1, 0.2, 0.3, 0.4]],
    [
      "span every series",
      [
        [1, 2],
        [40, 90],
      ],
      [0, 50, 100],
    ],
    ["open around one value", [[5, 5]], [2, 4, 6, 8]],
    ["open over a flat zero", [[0]], [0, 0.5, 1]],
  ])("%s", (_name, values, ticks) => {
    expect(lineTicks(values)).toEqual(ticks);
  });

  it("place each value evenly across and on the rules' scale", () => {
    expect(pointsOf([100, 120, 140], [100, 110, 120, 130, 140])).toEqual([
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 0 },
    ]);
    expect(pointsOf([5], [0, 10])).toEqual([{ x: 0.5, y: 0.5 }]);
  });

  it.each([
    [1500, [0, 500, 1000, 1500], "", "1,500"],
    [20000, [0, 10000, 20000], "", "20K"],
    [1500000, [0, 500000, 1000000, 1500000], "", "1.5M"],
    [0.2, [0.1, 0.2, 0.3], "", "0.2"],
    [-5, [-5, 0, 5], "", "−5"],
    [50, [0, 50, 100], "%", "50%"],
  ])("say %s on %j as %s%s", (value, ticks, unit, text) => {
    expect(tickText(value, ticks, unit)).toBe(text);
  });
});

describe("labels that fit", () => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  it("shows every label with room, and every few without", () => {
    expect(labelStep(months, 600)).toBe(1);
    expect(labelStep(months, 240)).toBe(2);
    expect(labelStep(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"], 240)).toBe(2);
  });

  it("keeps end labels apart and inside the plot, in the order given", () => {
    expect(spread([80, 20], 14, 0, 160)).toEqual([80, 20]);
    expect(spread([50, 52, 10], 14, 0, 160)).toEqual([50, 64, 10]);
    expect(spread([150, 158, 159], 14, 0, 160)).toEqual([132, 146, 160]);
  });
});
