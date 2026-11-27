// The Cells a question in Aski's chat found (`GET /api/stemcells/recall`), held by the
// message that asked: read once, when the question is first drawn, with no model in between
// (stemcells/tasks/aski-orchestrator.md, decision 8).

import { useEffect, useSyncExternalStore } from "react";

import { RECALL_PATH, type RecallAnswer } from "../../../../../stemcells/recall/card.ts";
import { recallAskOf } from "../../../../../stemcells/recall/question.ts";
import { getFromPrimary } from "../upstream/disk";

/** The most Cells shown under a question; the rest are counted. */
const PILLS = 6;
/** The questions whose Cells are held: a long talk with Aski lets the oldest go. */
const HELD = 80;

/** By message: its answer, or null while it is read, read as nothing, or failed. */
const held = new Map<string, RecallAnswer | null>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reads the Cells `text` asks about, once per message; `at` is when it was sent, so "yesterday"
 * under an old question stays the day before it.
 */
export function readRecall(
  messageId: string,
  text: string,
  at: number,
  get: typeof getFromPrimary = getFromPrimary,
): Promise<void> {
  if (held.has(messageId)) return Promise.resolve();
  const ask = recallAskOf(text, at);
  held.set(messageId, null);
  if (held.size > HELD) held.delete(held.keys().next().value!);
  if (ask === null) return Promise.resolve();
  return get(RECALL_PATH, {
    query: ask.query,
    limit: String(PILLS),
    ...(ask.from === null ? {} : { from: String(ask.from) }),
    ...(ask.to === null ? {} : { to: String(ask.to) }),
  })
    .then(async (response) => {
      if (!response.ok) return;
      const answer = (await response.json()) as RecallAnswer;
      if (!held.has(messageId)) return;
      held.set(messageId, answer);
      for (const listener of listeners) listener();
    })
    .catch(() => undefined);
}

/** The Cells the message's question found; null until read, and when it asked nothing. */
export function useRecall(messageId: string, text: string, at: number): RecallAnswer | null {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Ask the server, once a message, for the Cells its question names.
  useEffect(() => {
    void readRecall(messageId, text, at);
  }, [messageId, text, at]);
  return useSyncExternalStore(subscribe, () => held.get(messageId) ?? null);
}

/** Forgets every answer: a test starts clean. */
export function forgetRecall(): void {
  held.clear();
}
