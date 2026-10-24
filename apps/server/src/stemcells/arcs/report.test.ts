import { describe, expect, it } from "vite-plus/test";

import type { WeekArcs } from "./arcs.ts";
import { arcsReport } from "./report.ts";

const week = (overrides: Partial<WeekArcs>): WeekArcs => ({
  week: "2026-10-19",
  cells: 0,
  yourTurns: 0,
  turnsPerCell: null,
  flightMinutes: null,
  stops: { done: 0, yourStep: 0, asked: 0, stoppedShort: 0, waiting: 0, report: 0 },
  asksThroughTool: 0,
  permissions: 0,
  answerMinutes: null,
  ...overrides,
});

describe("the arcs, as Aski tells them", () => {
  it("sets this week against the last", () => {
    const report = arcsReport([
      week({
        week: "2026-10-12",
        cells: 40,
        turnsPerCell: 5,
        flightMinutes: 1.2,
        answerMinutes: 6.1,
      }),
      week({
        cells: 105,
        turnsPerCell: 3,
        flightMinutes: 1.8,
        answerMinutes: 4.4,
        asksThroughTool: 21,
        stops: { done: 150, yourStep: 72, asked: 45, stoppedShort: 9, waiting: 22, report: 430 },
      }),
    ]);
    expect(report).toBe(
      [
        "This week (from 2026-10-19), last week's in brackets: 105 Cells, 3 (5) of your turns a Cell, 1.8 (1.2) min of work between your turns.",
        "Asks: 21 on a card, 72 as your step, 45 in prose, answered in 4.4 (6.1) min.",
        "244 of 728 stops said where they stood.",
      ].join("\n"),
    );
  });

  it("leaves out what a week can't say", () => {
    const report = arcsReport([week({ cells: 2 })]);
    expect(report.split("\n")[0]).toBe("This week (from 2026-10-19): 2 Cells.");
    expect(report).not.toContain("null");
  });

  it("says so when nothing ran", () => {
    expect(arcsReport([week({}), week({ week: "2026-10-26" })])).toBe(
      "No Cells have run on this server in the last eight weeks.",
    );
  });
});
