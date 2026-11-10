import { describe, expect, it } from "vite-plus/test";

import type { Need } from "./derive.ts";
import type { CellStanding } from "./stage.ts";
import { standingOf } from "./standing.ts";

const need = (over: Partial<Need> & Pick<Need, "number" | "kind" | "threadId">): Need => ({
  key: `${over.threadId}:${over.kind}`,
  projectId: "p-harbor",
  parentThreadId: null,
  title: "Floof",
  providerInstanceId: "claude",
  since: "2026-10-24T09:00:00.000Z",
  blocks: false,
  request: null,
  plan: null,
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
  brief: null,
  ...over,
});

const cell = (
  over: Partial<CellStanding> & Pick<CellStanding, "threadId" | "stage">,
): CellStanding => ({
  projectId: "p-atlas",
  title: "Otter",
  line: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  since: null,
  holds: null,
  landing: null,
  brief: null,
  ...over,
});

describe("the room in words", () => {
  it("names each ask by the number its card shows, every Cell linked", () => {
    const standing = standingOf(
      {
        later: [],
        // Arrival order, as the list holds them: 2 was answered, so 1 and 3 remain.
        needs: [
          need({
            number: 3,
            kind: "prose",
            threadId: "t-review",
            parentThreadId: "t-floof",
            title: "reviewer",
            prose: {
              runId: "r1",
              cue: "left",
              text: "approve the billing change",
              steps: ["approve the billing change"],
              next: null,
              lead: null,
            },
          }),
          need({
            number: 1,
            kind: "plan",
            threadId: "t-floof",
            plan: planNamed("Split the export"),
          }),
        ],
        cells: [
          cell({ threadId: "t-floof", stage: "needs-you", title: "Floof", projectId: "p-harbor" }),
          cell({ threadId: "t-otter", stage: "working", line: "the checks on #212" }),
          cell({ threadId: "t-pip", stage: "done", title: "Pip", line: "#281 merged" }),
        ],
      },
      new Map([
        ["p-harbor", "Harbor"],
        ["p-atlas", "Atlas"],
      ]),
    );
    expect(standing.report.split("\n")).toEqual([
      "Needs you (2):",
      "1 [Floof](t3-thread://v1/t-floof) · Harbor · plan ready: Split the export",
      "3 [Floof › reviewer](t3-thread://v1/t-review) · Harbor · your step: approve the billing change",
      "",
      "At work (1):",
      "[Otter](t3-thread://v1/t-otter) · Atlas · the checks on #212",
      "",
      "Done, not settled (1):",
      "[Pip](t3-thread://v1/t-pip) · Atlas · #281 merged",
    ]);
    expect(standing).toMatchObject({ needsYou: 2, atWork: 1, done: 1 });
  });

  it("lists Cells a usage limit holds once, under the limit, and out of the Cells at work", () => {
    const held = { projectId: "p-atlas", since: "2026-10-24T09:00:00.000Z", carriesOn: true };
    const standing = standingOf(
      {
        later: [],
        needs: [],
        cells: [
          cell({ threadId: "t-otter", stage: "working", holds: "limit:claude:1" }),
          cell({ threadId: "t-pip", stage: "working", title: "Pip", holds: "limit:claude:1" }),
          cell({ threadId: "t-wren", stage: "working", title: "Wren" }),
        ],
        conditions: [
          {
            key: "limit:claude:1",
            kind: "limit",
            providerInstanceId: "claude",
            resetAt: "2026-10-24T14:00:00.000Z",
            since: "2026-10-24T09:00:00.000Z",
            waits: "reset",
            cells: [
              { ...held, threadId: "t-otter", title: "Otter" },
              { ...held, threadId: "t-pip", title: "Pip" },
            ],
          },
        ],
      },
      new Map([["p-atlas", "Atlas"]]),
    );
    expect(standing.report.split("\n")).toEqual([
      "Nothing needs you.",
      "",
      "At work (1):",
      "[Wren](t3-thread://v1/t-wren) · Atlas",
      "",
      "Holding (2): usage limit on claude, resets 2026-10-24T14:00:00.000Z, then they carry on by themselves. Nothing to answer in any of them:",
      "[Otter](t3-thread://v1/t-otter) · Atlas",
      "[Pip](t3-thread://v1/t-pip) · Atlas",
    ]);
    expect(standing).toMatchObject({ needsYou: 0, atWork: 1, holding: 2, done: 0 });
  });

  it("says how each done Cell landed and what shows it, so a bare Done isn't passed on", () => {
    const { report } = standingOf(
      {
        later: [],
        needs: [
          need({
            number: 1,
            kind: "plan",
            threadId: "t-floof",
            plan: planNamed("Split the export"),
            brief: {
              goal: "Split the export into pages",
              changed: null,
              checks: [],
              pullRequest: null,
            },
          }),
        ],
        cells: [
          cell({
            threadId: "t-pip",
            stage: "done",
            title: "Pip",
            line: "tokens moved",
            landing: { verdict: "short", proof: "check-failed" },
            brief: {
              goal: null,
              changed: { files: 3, additions: 40, deletions: 8 },
              checks: [
                { kind: "test", ok: false },
                { kind: "lint", ok: true },
              ],
              pullRequest: {
                number: 12,
                url: "https://example.com/pull/12",
                state: "open",
                draft: false,
                checks: "pending",
                conflicts: true,
              },
            },
          }),
          cell({
            threadId: "t-otter",
            stage: "done",
            landing: { verdict: "claimed", proof: "word" },
          }),
        ],
      },
      new Map(),
    );
    expect(report.split("\n")).toEqual([
      "Needs you (1):",
      "1 [Floof](t3-thread://v1/t-floof) · p-harbor · plan ready: Split the export · told: Split the export into pages",
      "",
      "Done, not settled (2):",
      "[Pip](t3-thread://v1/t-pip) · p-atlas · tokens moved · landed short: a check it ran last failed · +40 −8 in 3 files · tests failed · lint clean · #12 open, checks pending, conflicts",
      "[Otter](t3-thread://v1/t-otter) · p-atlas · its word only: nothing it ran or opened shows it",
    ]);
  });
});

function planNamed(title: string): Need["plan"] {
  return { id: "plan-1", runId: "r0", title, steps: [], markdown: null };
}
