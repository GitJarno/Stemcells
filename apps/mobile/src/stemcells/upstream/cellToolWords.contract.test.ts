import {
  summarizeToolGroup,
  type WorkLogPresentationEntry,
  type WorkLogToolLifecycleStatus,
} from "@t3tools/client-runtime/work-log/presentation";
import { T3_MCP_TOOL_NAMES } from "@t3tools/shared/t3McpToolPresentation";
import { describe, expect, it } from "vite-plus/test";

import { workEntryRowLabel } from "../../lib/threadActivity";

/**
 * Contract: the phone's work log names T3's own tools in Cell words, as the
 * web's does (`apps/web/src/stemcells/upstream/cellToolWords.contract.test.ts`):
 * a row as its call runs, ends or fails, and the sentence a run of calls
 * sums up to, says no T3, thread or agent. If this fails after a sync,
 * upstream added or renamed a tool: give it Cell words in
 * `stemcells/words/cellTools.ts`.
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

describe("T3's own tools in the phone's work log", () => {
  it("knows upstream's tools", () => {
    expect(tools.length).toBeGreaterThan(50);
  });

  it.each(tools)("%s: a row says Cell, never T3, thread or agent", (tool) => {
    for (const status of STATUSES) {
      expect(workEntryRowLabel(call(tool, status)), tool).not.toMatch(NOT_OUR_WORDS);
    }
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
});
