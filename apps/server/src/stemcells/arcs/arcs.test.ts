import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import type { ArcRun } from "../upstream/arcs.ts";
import { weekOf, weeksOf } from "./arcs.ts";

// Thursday 23 October 2026 and the Monday that starts its week.
const DAY0 = Date.parse("2026-10-23T09:00:00.000Z");
const MONDAY = "2026-10-19";
const t = (minutes: number) => DateTime.formatIso(DateTime.makeUnsafe(DAY0 + minutes * 60_000));

const run = (threadId: string, from: number, to: number, reply: string | null): ArcRun => ({
  threadId,
  requestedAt: t(from),
  completedAt: t(to),
  status: "completed",
  reply,
});

describe("the arcs", () => {
  it("times a flight from one of the person's turns to their next, whoever started the runs", () => {
    const [week] = weeksOf(
      {
        // The person writes at 0 and at 60; between them the Cell runs twice,
        // the second time woken by its subagent, not by the person.
        turns: [
          { threadId: "pip", at: t(0) },
          { threadId: "pip", at: t(60) },
        ],
        runs: [
          run("pip", 0, 20, "Merged.\n\n**Done:** #12 merged"),
          run("pip", 30, 40, "**Done:** #13 merged"),
          run("pip", 60, 65, "**Done:** #14 merged"),
        ],
        requests: [],
      },
      DAY0,
      DAY0 + 60 * 60_000,
    );
    expect(week).toMatchObject({ week: MONDAY, cells: 1, yourTurns: 2, turnsPerCell: 2 });
    // 30 minutes of work after the first turn, 5 after the second.
    expect(week?.flightMinutes).toBe(17.5);
    expect(week?.stops.done).toBe(3);
  });

  it("reads each stop by its close-out and times the person's answer to an ask", () => {
    const [week] = weeksOf(
      {
        turns: [
          { threadId: "fern", at: t(0) },
          { threadId: "fern", at: t(25) },
        ],
        runs: [
          run("fern", 0, 15, "Drafted.\n\n**Left:**\n- you: send the reply\n- me: merge it"),
          run("fern", 25, 30, "Pushed.\n\n**Left:**\n- waiting: CI on #9"),
        ],
        requests: [
          {
            threadId: "fern",
            kind: "user_input",
            status: "resolved",
            createdAt: t(26),
            resolvedAt: t(28),
          },
        ],
      },
      DAY0,
      DAY0 + 60 * 60_000,
    );
    expect(week?.stops).toMatchObject({ yourStep: 1, waiting: 1, done: 0 });
    expect(week?.asksThroughTool).toBe(1);
    // The Left was answered 10 minutes after it, the tool's question in 2.
    expect(week?.answerMinutes).toBe(6);
  });

  it("starts weeks on Monday", () => {
    expect(weekOf(Date.parse("2026-10-19T00:00:00.000Z"))).toBe("2026-10-19");
    expect(weekOf(Date.parse("2026-10-25T23:59:59.000Z"))).toBe("2026-10-19");
  });
});
