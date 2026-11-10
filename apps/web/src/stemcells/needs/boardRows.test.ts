import { describe, expect, it } from "vite-plus/test";

import { boardOf } from "./boardRows";
import type { CellStanding } from "./wire";

const cell = (
  threadId: string,
  stage: CellStanding["stage"],
  over: Partial<CellStanding> = {},
): CellStanding => ({
  threadId,
  projectId: "p-harbor",
  title: threadId,
  stage,
  line: null,
  createdAt: "2026-11-10T08:00:00.000Z",
  ...over,
});

const landed = (threadId: string, verdict: "shown" | "claimed" | "short") =>
  cell(threadId, "done", {
    landing: {
      verdict,
      proof: verdict === "shown" ? "checks-clean" : verdict === "claimed" ? "word" : "stopped",
    },
  });

describe("the room's board", () => {
  it("reads a short landing first, then one on its word, keeping the newest first inside each", () => {
    const board = boardOf([
      landed("shown-new", "shown"),
      landed("word-new", "claimed"),
      cell("asking", "needs-you"),
      landed("short", "short"),
      cell("flying", "working"),
      landed("word-old", "claimed"),
    ]);
    expect(board.landed.map((row) => row.threadId)).toEqual([
      "short",
      "word-new",
      "word-old",
      "shown-new",
    ]);
    expect(board.flying.map((row) => row.threadId)).toEqual(["flying"]);
  });

  it("says why a landing is short or unshown only where no fact beside it does", () => {
    const [stopped] = boardOf([landed("otter", "short")]).landed;
    expect(stopped?.why).toBe("Stopped before it finished");
    const [failing] = boardOf([
      cell("pip", "done", {
        landing: { verdict: "short", proof: "check-failed" },
        brief: {
          goal: null,
          changed: null,
          checks: [{ kind: "test", ok: false }],
          pullRequest: null,
        },
      }),
    ]).landed;
    expect(failing).toMatchObject({ why: null, facts: [{ text: "Tests failed", tone: "bad" }] });
  });

  it("shows a stage's first rows and still counts them all", () => {
    const board = boardOf(
      Array.from({ length: 9 }, (_, index) => cell(`cell-${index}`, "working")),
      6,
    );
    expect(board.flying).toHaveLength(6);
    expect(board.counts).toEqual({ flying: 9, landed: 0 });
  });

  it("draws a Cell from a server before verdicts with no mark, last", () => {
    const board = boardOf([cell("old", "done"), landed("new", "shown")]);
    expect(board.landed.map((row) => [row.threadId, row.verdict])).toEqual([
      ["new", "shown"],
      ["old", null],
    ]);
  });
});
