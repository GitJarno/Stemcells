import type { ContextWindowSnapshot } from "../upstream/compaction";

/**
 * A chat's context against where it compacts, when its provider says (`autoCompactThreshold`),
 * so the ring is full as it compacts: a Claude Cell under a 500k window on a 1M model fills
 * toward 467k. Otherwise as upstream measures it, against the model's whole context.
 */
export function towardCompaction(usage: ContextWindowSnapshot): ContextWindowSnapshot {
  const compactsAt = usage.autoCompactThreshold;
  if (compactsAt === null || compactsAt === undefined || compactsAt <= 0) return usage;
  const usedPercentage = Math.min(100, (usage.usedTokens / compactsAt) * 100);
  return {
    ...usage,
    maxTokens: compactsAt,
    remainingTokens: Math.max(0, Math.round(compactsAt - usage.usedTokens)),
    usedPercentage,
    remainingPercentage: Math.max(0, 100 - usedPercentage),
  };
}
