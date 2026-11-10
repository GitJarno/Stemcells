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
  it("reads a short landing first, then one on its word, the latest to land first inside each", () => {
    const board = boardOf([
      landed("shown-new", "shown"),
      { ...landed("word-old", "claimed"), since: "2026-11-10T09:00:00.000Z" },
      cell("asking", "needs-you"),
      landed("short", "short"),
      cell("flying", "working"),
      { ...landed("word-new", "claimed"), since: "2026-11-10T09:30:00.000Z" },
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
      [],
      6,
    );
    expect(board.flying).toHaveLength(6);
    expect(board.counts).toEqual({ holding: 0, flying: 9, landed: 0 });
  });

  it("lists a Cell a usage limit holds under the limit, and out of the ones flying", () => {
    const held = { projectId: "p-harbor", since: "2026-11-10T09:00:00.000Z", carriesOn: true };
    const board = boardOf(
      [
        cell("otter", "working", { holds: "limit:claude:1" }),
        cell("pip", "working", { holds: "limit:claude:1" }),
        cell("wren", "working"),
      ],
      [
        {
          key: "limit:claude:1",
          kind: "limit",
          providerInstanceId: "claude",
          resetAt: "2026-11-10T14:00:00.000Z",
          since: "2026-11-10T09:00:00.000Z",
          waits: "reset",
          cells: [
            { ...held, threadId: "otter", title: "Otter" },
            { ...held, threadId: "pip", title: "Pip" },
          ],
        },
      ],
    );
    expect(board.flying.map((row) => row.threadId)).toEqual(["wren"]);
    expect(board.holding.map((stage) => stage.rows.map((row) => row.threadId))).toEqual([
      ["otter", "pip"],
    ]);
    expect(board.counts).toEqual({ holding: 2, flying: 1, landed: 0 });
  });

  it("draws a Cell from a server before verdicts with no mark, last", () => {
    const board = boardOf([cell("old", "done"), landed("new", "shown")]);
    expect(board.landed.map((row) => [row.threadId, row.verdict])).toEqual([
      ["new", "shown"],
      ["old", null],
    ]);
  });
});
