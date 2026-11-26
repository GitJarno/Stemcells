import {
  workEntryHiddenByToolCallVisibility,
  type WorkLogPresentationEntry,
} from "@t3tools/client-runtime/work-log/presentation";
import { describe, expect, it } from "vite-plus/test";

/**
 * Upstream's "Hide successful", which Stemcells sets once per install (`work/quietWork.ts`): what a
 * finished run did steps aside, and what the agent looked at stays (a seam in `presentation.ts`).
 */
const entry = (over: Partial<WorkLogPresentationEntry>): WorkLogPresentationEntry => ({
  id: "e",
  createdAt: "2026-11-26T12:00:00.000Z",
  label: "Ran cat",
  tone: "tool",
  itemType: "command_execution",
  toolLifecycleStatus: "completed",
  ...over,
});

describe("Hide successful", () => {
  it.each([
    ["a finished command steps aside", entry({}), true],
    [
      "a running command stays, as the live line",
      entry({ toolLifecycleStatus: "inProgress" }),
      false,
    ],
    ["a failed command stays", entry({ tone: "error", toolLifecycleStatus: "failed" }), false],
    [
      "an image the agent looked at stays",
      entry({ itemType: "dynamic_tool", label: "Read look.png", viewedImagePath: "/tmp/look.png" }),
      false,
    ],
  ])("%s", (_name, work, hidden) => {
    expect(workEntryHiddenByToolCallVisibility(work, "hideSuccessful")).toBe(hidden);
  });
});
