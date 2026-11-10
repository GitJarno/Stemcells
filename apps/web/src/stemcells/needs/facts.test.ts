import { describe, expect, it } from "vite-plus/test";

import { barOf, changedWords, factsOf } from "./facts";
import type { Brief } from "./wire";

const brief = (over: Partial<Brief>): Brief => ({
  goal: null,
  changed: null,
  checks: [],
  pullRequest: null,
  ...over,
});

const pullRequest = (over: Partial<NonNullable<Brief["pullRequest"]>>) => ({
  number: 12,
  url: "https://example.com/pull/12",
  state: "open" as const,
  draft: false,
  checks: null,
  conflicts: false,
  ...over,
});

describe("the change's bar", () => {
  const bar = (additions: number, deletions: number) =>
    barOf({ files: 1, additions, deletions })
      .map((cell) => (cell === "added" ? "+" : "-"))
      .join("");

  it("splits five cells by share, and never hides a side that has lines", () => {
    expect(bar(340, 88)).toBe("++++-");
    expect(bar(1, 900)).toBe("+----");
    expect(bar(900, 1)).toBe("++++-");
    expect(bar(10, 0)).toBe("+++++");
    expect(bar(0, 10)).toBe("-----");
  });

  it("is empty when no line changed", () => {
    expect(bar(0, 0)).toBe("");
    expect(barOf(null)).toEqual([]);
  });
});

it("counts a change as the diff panel does", () => {
  expect(changedWords({ files: 12, additions: 1340, deletions: 88 })).toBe("+1,340 −88 · 12 files");
  expect(changedWords({ files: 1, additions: 2, deletions: 0 })).toBe("+2 −0 · 1 file");
});

describe("what a run shows", () => {
  it("says each check as it ended, then the pull request with its link", () => {
    expect(
      factsOf(
        brief({
          checks: [
            { kind: "test", ok: false },
            { kind: "lint", ok: true },
          ],
          pullRequest: pullRequest({ checks: "pending" }),
        }),
      ),
    ).toEqual([
      { id: "test", text: "Tests failed", tone: "bad", href: null },
      { id: "lint", text: "Lint passed", tone: "good", href: null },
      {
        id: "pull-request",
        text: "#12 · open · checks pending",
        tone: "plain",
        href: "https://example.com/pull/12",
      },
    ]);
  });

  it.each([
    [pullRequest({ checks: "failing" }), "#12 · open · checks failing", "bad"],
    [
      pullRequest({ checks: "passing", conflicts: true }),
      "#12 · open · checks passing · conflicts",
      "bad",
    ],
    [pullRequest({ checks: "passing" }), "#12 · open · checks passing", "good"],
    [pullRequest({ draft: true }), "#12 · draft", "plain"],
    // A merged or closed pull request's old checks and conflicts say nothing any more.
    [pullRequest({ state: "merged", checks: "failing", conflicts: true }), "#12 · merged", "good"],
    [pullRequest({ state: "closed", checks: "passing" }), "#12 · closed", "plain"],
  ] as const)("%j reads %s", (pr, text, tone) => {
    expect(factsOf(brief({ pullRequest: pr })).at(-1)).toMatchObject({ text, tone });
  });

  it("is nothing for a server before the brief", () => {
    expect(factsOf(undefined)).toEqual([]);
    expect(factsOf(null)).toEqual([]);
  });
});
