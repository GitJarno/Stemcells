/**
 * Upstream behaviour Aski's moments rely on. A failure here after a sync
 * names the contract that moved; "Back. Nothing dropped." could then be
 * said after a run was lost.
 */
import type { ThreadCheckpointSummary } from "@t3tools/client-runtime/state/thread-checkpoints";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type {
  OrchestrationV2ProjectedTurnItem,
  ThreadPullRequestSnapshot,
} from "@t3tools/contracts";
import { describe, expectTypeOf, it } from "vite-plus/test";

describe("what Aski's moments read from upstream", () => {
  it("a thread's latest run says it failed or was cut off, and when it ended", () => {
    type Run = NonNullable<EnvironmentThreadShell["latestRun"]>;
    expectTypeOf<"failed">().toExtend<Run["status"]>();
    expectTypeOf<"interrupted">().toExtend<Run["status"]>();
    expectTypeOf<Run["completedAt"]>().toExtend<string | null>();
    expectTypeOf<EnvironmentThreadShell["updatedAt"]>().toExtend<string>();
  });

  it("a run that landed says so, with when it was asked for and started", () => {
    type Run = NonNullable<EnvironmentThreadShell["latestRun"]>;
    expectTypeOf<"completed">().toExtend<Run["status"]>();
    expectTypeOf<"cancelled">().toExtend<Run["status"]>();
    expectTypeOf<Run["requestedAt"]>().toExtend<string | null>();
    expectTypeOf<Run["startedAt"]>().toExtend<string | null>();
  });

  it("a chat started through the tools says a chat made it, over MCP", () => {
    type Source = EnvironmentThreadShell["source"];
    expectTypeOf<"agent">().toExtend<Source["createdBy"]>();
    expectTypeOf<"mcp">().toExtend<Source["creationSource"]>();
  });

  it("a linked pull request's last sync says it merged, into what, when, and how big it was", () => {
    expectTypeOf<"merged">().toExtend<ThreadPullRequestSnapshot["state"]>();
    expectTypeOf<ThreadPullRequestSnapshot["mergedAt"]>().toExtend<string | null | undefined>();
    expectTypeOf<ThreadPullRequestSnapshot["baseBranch"]>().toExtend<string>();
    expectTypeOf<ThreadPullRequestSnapshot["additions"]>().toExtend<number | undefined>();
    expectTypeOf<ThreadPullRequestSnapshot["deletions"]>().toExtend<number | undefined>();
  });

  it("an armed limit recovery names the stopped run, the reset and whether it carries on", () => {
    type Recovery = NonNullable<EnvironmentThreadShell["limitRecovery"]>;
    expectTypeOf<Recovery["runId"]>().toExtend<string>();
    expectTypeOf<Recovery["resetAt"]>().toExtend<string>();
    expectTypeOf<Recovery["autoResume"]>().toExtend<boolean>();
  });

  it("a run's items show a compaction and the person's words; its checkpoint, the turns its diff spans", () => {
    type Item = OrchestrationV2ProjectedTurnItem["item"];
    expectTypeOf<"compaction">().toExtend<Item["type"]>();
    expectTypeOf<Extract<Item, { type: "user_message" }>["text"]>().toExtend<string>();
    expectTypeOf<Item["runId"]>().toExtend<string | null>();
    expectTypeOf<"ready">().toExtend<ThreadCheckpointSummary["status"]>();
    expectTypeOf<ThreadCheckpointSummary["checkpointTurnCount"]>().toExtend<number>();
  });
});
