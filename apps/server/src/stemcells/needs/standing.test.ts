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
  ...over,
});

const cell = (over: Partial<CellStanding> & Pick<CellStanding, "threadId" | "stage">) => ({
  projectId: "p-atlas",
  title: "Otter",
  line: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  ...over,
});

describe("the room in words", () => {
  it("names each ask by the number its card shows, every Cell linked", () => {
    const standing = standingOf(
      {
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
              links: [],
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
});

function planNamed(title: string): Need["plan"] {
  return { id: "plan-1", runId: "r0", title, steps: [], markdown: null };
}
