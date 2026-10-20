import { describe, expect, it } from "vite-plus/test";

import type { ContextWindowSnapshot } from "../upstream/compaction";
import { towardCompaction } from "./meter";

const snapshot = (
  usedTokens: number,
  maxTokens: number | null,
  autoCompactThreshold: number | null,
): ContextWindowSnapshot => ({
  usedTokens,
  totalProcessedTokens: null,
  maxTokens,
  remainingTokens: maxTokens === null ? null : maxTokens - usedTokens,
  usedPercentage: maxTokens === null ? null : (usedTokens / maxTokens) * 100,
  remainingPercentage: maxTokens === null ? null : 100 - (usedTokens / maxTokens) * 100,
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningOutputTokens: null,
  lastUsedTokens: null,
  lastInputTokens: null,
  lastCachedInputTokens: null,
  lastOutputTokens: null,
  lastReasoningOutputTokens: null,
  toolUses: null,
  durationMs: null,
  compactsAutomatically: true,
  autoCompactThreshold,
  cost: null,
  updatedAt: "2026-10-21T00:00:00.000Z",
});

describe("the context meter's fill", () => {
  it("is full where a Claude Cell compacts, not at the model's whole context", () => {
    const usage = towardCompaction(snapshot(467_000, 1_000_000, 467_000));
    expect(usage.usedPercentage).toBe(100);
    expect(usage.remainingTokens).toBe(0);
    expect(usage.maxTokens).toBe(467_000);
  });

  it("measures a smaller model against its own compaction point", () => {
    const usage = towardCompaction(snapshot(83_500, 200_000, 167_000));
    expect(usage.usedPercentage).toBe(50);
    expect(usage.remainingPercentage).toBe(50);
  });

  it("stays as upstream measures it when the provider names no compaction point", () => {
    const usage = snapshot(250_000, 1_000_000, null);
    expect(towardCompaction(usage)).toBe(usage);
  });
});
