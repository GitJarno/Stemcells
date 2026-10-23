import { costOf, type Pricing, type SpendRow } from "../upstream/spend.ts";

/** One chat's spend, as `GET /api/stemcells/spend` sends it. */
export interface ThreadSpend {
  /** Every token its turns reported: input with its cache reads and writes, and output. */
  readonly tokens: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
  /** Its priced tokens at list price, in US dollars; null when none had a price. */
  readonly costUsd: number | null;
  /**
   * The count is short: a turn whose provider gave none, a turn on a model
   * with no price, or subagents, whose own tokens are left out.
   */
  readonly short: boolean;
}

/** The rows folded into one spend per chat. */
export function spendByThread(
  rows: ReadonlyArray<SpendRow>,
  pricing: Pricing,
): Record<string, ThreadSpend> {
  const byThread: Record<string, ThreadSpend> = {};
  for (const row of rows) {
    const cost = costOf(pricing, row);
    const before = byThread[row.threadId];
    byThread[row.threadId] = {
      tokens: (before?.tokens ?? 0) + row.inputTokens + row.outputTokens,
      inputTokens: (before?.inputTokens ?? 0) + row.inputTokens,
      cachedInputTokens: (before?.cachedInputTokens ?? 0) + row.cachedInputTokens,
      outputTokens: (before?.outputTokens ?? 0) + row.outputTokens,
      costUsd: cost === null ? (before?.costUsd ?? null) : (before?.costUsd ?? 0) + cost,
      short:
        (before?.short ?? false) ||
        row.uncountedTurns > 0 ||
        row.subagentTurns > 0 ||
        (cost === null && row.inputTokens + row.outputTokens > 0),
    };
  }
  return byThread;
}
