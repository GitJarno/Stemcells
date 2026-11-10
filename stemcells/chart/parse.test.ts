import { describe, expect, it } from "vite-plus/test";

import { parseChart } from "./parse.ts";

const table = (head: string, ...rows: string[]) =>
  [head, head.replace(/[^|]+/g, " --- "), ...rows].join("\n");

describe("a chart fence, read", () => {
  it("reads a titled bar chart: labels in the order given, one series a column", () => {
    const chart = parseChart(
      `bar: Files that conflicted in each sync\n${table("| Sync | Files |", "| 21 Oct | 2 |", "| 26 Oct | 22 |")}`,
    );
    expect(chart).toEqual({
      kind: "bar",
      title: "Files that conflicted in each sync",
      labelHeader: "Sync",
      labels: ["21 Oct", "26 Oct"],
      series: [{ header: "Files", name: "Files", unit: "", values: [2, 22], texts: ["2", "22"] }],
    });
  });

  it.each([
    ["no first line", table("| A | B |", "| x | 1 |"), "bar", ""],
    ["a line chart", `line: Latency\n${table("| A | B |", "| x | 1 |")}`, "line", "Latency"],
    ["a kind with no title", `LINE\n\n${table("A | B", "x | 1")}`, "line", ""],
  ])("takes its kind and title from the first line: %s", (_name, source, kind, title) => {
    expect(parseChart(source)).toMatchObject({ kind, title, labels: ["x"] });
  });

  it("takes a unit from the header's brackets, else from cells that carry %", () => {
    const chart = parseChart(
      table(
        "| Step | Time (ms) | Share | Count |",
        "| a | 1,200 | 45% | 3 |",
        "| b | 80 | 5.5% | 4 |",
      ),
    );
    expect(chart?.series.map((series) => [series.name, series.unit])).toEqual([
      ["Time", "ms"],
      ["Share", "%"],
      ["Count", ""],
    ]);
    expect(chart?.series[0]?.header).toBe("Time (ms)");
    expect(chart?.series[1]?.values).toEqual([45, 5.5]);
  });

  it.each([
    ["1,234,567", 1234567],
    ["1 234.5", 1234.5],
    ["~1,200", 1200],
    ["< 5", 5],
    [">99.9%", 99.9],
    ["-3", -3],
    ["−3.5", -3.5],
    ["**12**", 12],
    [".5", 0.5],
  ])("reads %s as a number and keeps it as written", (cell, value) => {
    const series = parseChart(table("| A | B |", `| x | ${cell} |`))?.series[0];
    expect(series?.values).toEqual([value]);
    expect(series?.texts).toEqual([cell.replace(/\*/g, "")]);
  });

  it.each([
    ["no table", "bar: Nothing here\njust words"],
    ["an unknown first line", `pie: Shares\n${table("| A | B |", "| x | 1 |")}`],
    ["a header and no rows", "| A | B |\n| --- | --- |"],
    ["no rule under the header", "| A | B |\n| x | 1 |"],
    ["labels and no series", table("| A |", "| x |")],
    ["a fifth series", table("| A | B | C | D | E | F |", "| x | 1 | 2 | 3 | 4 | 5 |")],
    ["a cell that isn't a number", table("| A | B |", "| x | 1 |", "| y | n/a |")],
    ["an empty cell", table("| A | B |", "| x | |")],
    ["a number with a unit in its cell", table("| A | B |", "| x | 12 ms |")],
    ["a grouping that isn't thousands", table("| A | B |", "| x | 1,23 |")],
    ["a row short a cell", table("| A | B | C |", "| x | 1 |")],
    ["words after the table", `${table("| A | B |", "| x | 1 |")}\n\nand a note`],
  ])("falls back on %s", (_name, source) => {
    expect(parseChart(source)).toBeNull();
  });

  it("holds four series, and a pipe written in a label", () => {
    const chart = parseChart(table("| A | B | C | D | E |", "| a \\| b | 1 | 2 | 3 | 4 |"));
    expect(chart?.series).toHaveLength(4);
    expect(chart?.labels).toEqual(["a | b"]);
  });
});
