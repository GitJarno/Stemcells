import {
  resolveWorkEntryToolPresentation,
  summarizeToolGroup,
  type WorkLogPresentationEntry,
  type WorkLogToolLifecycleStatus,
} from "@t3tools/client-runtime/work-log/presentation";
import { T3_MCP_TOOL_NAMES } from "@t3tools/shared/t3McpToolPresentation";
import { describe, expect, it } from "vite-plus/test";

import {
  liveWorkEntryLabel,
  workEntryDisplayLabel,
} from "../../components/chat/MessagesTimeline.logic";
import { threadReadLabelPrefix } from "./substitutes/MessagesTimeline.logic";

/**
 * Contract: every work log label a person reads for T3's own tools says no T3, thread or agent.
 * Upstream builds them from `@t3tools/shared/t3McpToolPresentation` and
 * `@t3tools/client-runtime/t3ToolSummary`, which the substitutes replace
 * (`stemcells/words/cellTools.ts`). If this fails after a sync, give the new tool Cell words.
 */

const NOT_OUR_WORDS = /\bT3\b|thread|agent/i;
const STATUSES: ReadonlyArray<WorkLogToolLifecycleStatus | undefined> = [
  undefined,
  "inProgress",
  "completed",
  "failed",
  "declined",
  "stopped",
];

function call(
  tool: string,
  status: WorkLogToolLifecycleStatus | undefined,
  threadId?: string,
): WorkLogPresentationEntry {
  const ids = threadId === undefined ? {} : { threadId, messageId: `${threadId}-message` };
  return {
    id: `${tool}-${threadId ?? "unknown"}`,
    createdAt: "2026-10-21T00:00:00.000Z",
    label: tool,
    tone: "tool",
    toolTitle: `mcp__t3-code__${tool}`,
    ...(status === undefined ? {} : { toolLifecycleStatus: status }),
    toolData: { input: ids, output: ids },
  };
}

const tools = [...T3_MCP_TOOL_NAMES];

describe("T3's own tools in the work log", () => {
  it("knows upstream's tools", () => {
    expect(tools.length).toBeGreaterThan(50);
  });

  it.each(tools)("%s: a call says Cell, never T3, thread or agent", (tool) => {
    const labels = STATUSES.map(
      (status) => resolveWorkEntryToolPresentation(call(tool, status))?.displayName,
    );
    for (const label of labels) {
      expect(label, tool).toBeTypeOf("string");
      expect(label, tool).not.toMatch(NOT_OUR_WORDS);
    }
  });

  // An action tool's call reads as the tool its action replaced.
  it.each([
    ["fork", "Requested a fork of this Cell"],
    ["merge_back", "Requested a merge of a Cell's context"],
    ["status", "Read a Cell's transfers"],
  ])("a transfer's %s reads as that action", (action, label) => {
    const transfer = {
      ...call("t3_thread_transfer", "completed"),
      toolData: { input: { action }, output: {} },
    };
    expect(resolveWorkEntryToolPresentation(transfer)?.displayName).toBe(label);
  });

  it.each(tools)("%s: a run of calls sums up in Cell words", (tool) => {
    const runs = [
      [call(tool, "completed", "a")],
      [call(tool, "completed", "a"), call(tool, "completed", "b")],
      [call(tool, "completed"), call(tool, "completed")],
      [call(tool, "failed", "a")],
      [call(tool, "inProgress")],
    ];
    for (const run of runs) {
      expect(summarizeToolGroup(run).summary, tool).not.toMatch(NOT_OUR_WORDS);
    }
  });

  it.each([
    ["inProgress", true, "Reading Cell"],
    ["completed", false, "Read Cell"],
    ["failed", false, "Failed to read Cell"],
    ["declined", false, "Declined to read Cell"],
    ["stopped", false, "Stopped reading Cell"],
  ] as const)("a %s read of another Cell names it by its title", (status, active, prefix) => {
    // The timeline writes `${prefix} “Title”`, the title a link to that Cell.
    const read = {
      ...call("t3_thread_read", status),
      itemType: "dynamic_tool" as const,
      structuredPayload: {
        type: "dynamic_tool",
        toolName: "t3-code.t3_thread_read",
        input: { threadId: "cell-child" },
      } as never,
    };
    expect(threadReadLabelPrefix(liveWorkEntryLabel(read, undefined, active))).toBe(prefix);
    expect(threadReadLabelPrefix(workEntryDisplayLabel(read, undefined))).toBe(prefix);
  });
});
