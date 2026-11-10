// The one deriver: every fact that is true of a chat now, read from upstream's records of it.
// The live tap and the backfill both run it, and the ledger keeps whatever it hasn't yet
// (`Ledger.ts`). It decides; it reads and writes nothing.

import * as DateTime from "effect/DateTime";

import { aloneIn } from "../../../../../stemcells/ledger/alone.ts";
import type { Fact } from "../../../../../stemcells/ledger/facts.ts";
import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { readCloseOut } from "../needs/closeOut.ts";
import type { LedgerThread } from "../upstream/ledger.ts";

/** An ISO time as upstream writes its own; null when the words aren't a time. */
function isoOf(words: string | null): string | null {
  const ms = words === null ? Number.NaN : Date.parse(words);
  return Number.isFinite(ms) ? DateTime.formatIso(DateTime.makeUnsafe(ms)) : null;
}

export function factsOf(thread: LedgerThread): Fact[] {
  const { threadId } = thread;
  const facts: Fact[] = [
    {
      key: `born:${threadId}`,
      kind: "born",
      threadId,
      at: thread.createdAt,
      data: { name: cellNameOf(threadId), driver: thread.driver, projectId: thread.projectId },
    },
  ];
  for (const run of thread.runs) {
    // Landed is completed and nothing else: a run stopped, failed, cancelled or rolled back
    // didn't land, and one still going counts once it does (`stemcells/tasks/cell-growth.md`).
    if (run.status !== "completed" || run.startedAt === null || run.completedAt === null) continue;
    const from = Date.parse(run.startedAt);
    const to = Date.parse(run.completedAt);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const waits = run.requests.flatMap((request) =>
      request.blocking
        ? [
            {
              from: Date.parse(request.createdAt),
              to: request.resolvedAt === null ? Infinity : Date.parse(request.resolvedAt),
            },
          ]
        : [],
    );
    facts.push({
      key: `landed:${run.runId}`,
      kind: "landed",
      threadId,
      at: run.completedAt,
      data: {
        runId: run.runId,
        ms: Math.max(0, to - from),
        aloneMs: aloneIn({ from, to, waits }),
        asks: run.requests.length,
        closeOut: run.reply === null ? null : (readCloseOut(run.reply).closeOut?.kind ?? null),
      },
    });
  }
  // Each settle is its own fact: a chat settled, taken up again and settled again did both.
  if (thread.settledAt !== null) {
    facts.push({
      key: `settled:${threadId}:${thread.settledAt}`,
      kind: "settled",
      threadId,
      at: thread.settledAt,
      data: {},
    });
  }
  for (const merge of thread.merged) {
    const at = isoOf(merge.mergedAt) ?? isoOf(merge.syncedAt);
    if (at === null) continue;
    facts.push({
      key: `merged:${threadId}:${merge.id}`,
      kind: "merged",
      threadId,
      at,
      data: { number: merge.number },
    });
  }
  return facts;
}
