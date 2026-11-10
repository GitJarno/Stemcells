// The one deriver: every fact that is true of a chat now, read from upstream's records of it,
// its own facts (`factsOf`) and each of its runs' (`landedOf`), since a long chat's runs are
// read a page at a time. The live tap and the backfill both run it, and the ledger keeps
// whatever it hasn't yet (`Ledger.ts`). It decides; it reads and writes nothing.

import * as DateTime from "effect/DateTime";

import { aloneIn } from "../../../../../stemcells/ledger/alone.ts";
import type { Fact } from "../../../../../stemcells/ledger/facts.ts";
import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { readCloseOut } from "../needs/closeOut.ts";
import type { LedgerRun, LedgerThread } from "../upstream/ledger.ts";

/** An ISO time as upstream writes its own; null when the words aren't a time. */
function isoOf(words: string | null): string | null {
  const ms = words === null ? Number.NaN : Date.parse(words);
  return Number.isFinite(ms) ? DateTime.formatIso(DateTime.makeUnsafe(ms)) : null;
}

/** The facts of a chat itself: it was made, it is settled, a pull request of its merged. */
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
    // Only at the forge's own merge time. Upstream reads a merge again until its forge gives
    // one, and a time of ours (its last read) would stand for good: the first write is kept.
    const at = isoOf(merge.mergedAt);
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

/**
 * The fact of a run, when it landed. Landed is completed and nothing else: a run stopped,
 * failed, cancelled or rolled back didn't land, and one still going counts once it does
 * (`stemcells/tasks/cell-growth.md`).
 */
export function landedOf(run: LedgerRun): Fact[] {
  if (run.status !== "completed" || run.startedAt === null || run.completedAt === null) return [];
  const from = Date.parse(run.startedAt);
  const to = Date.parse(run.completedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  const waits = run.requests.map((request) => ({
    from: Date.parse(request.createdAt),
    to: request.resolvedAt === null ? Infinity : Date.parse(request.resolvedAt),
  }));
  return [
    {
      key: `landed:${run.runId}`,
      kind: "landed",
      threadId: run.threadId,
      at: run.completedAt,
      data: {
        runId: run.runId,
        ms: Math.max(0, to - from),
        aloneMs: aloneIn({ from, to, waits }),
        // The same requests growth counts as waits: the ones that held the run.
        asks: run.requests.length,
        closeOut: run.reply === null ? null : (readCloseOut(run.reply).closeOut?.kind ?? null),
      },
    },
  ];
}
