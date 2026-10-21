/**
 * Upstream behaviour Aski's moments rely on. A failure here after a sync
 * names the contract that moved; "Back. Nothing dropped." could then be
 * said after a run was lost.
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
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
});
