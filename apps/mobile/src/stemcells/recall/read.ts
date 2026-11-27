// The Cells each question in Aski's chat found, as the phone holds them: by the message that
// asked, read once from the chat's own machine (`GET /api/stemcells/recall`). No view and no
// connection of its own: `recall.ts` gives it the line to a machine.

import { useSyncExternalStore } from "react";

import { RECALL_PATH, type RecallAnswer, recallAskOf } from "./kit";

/** What a machine's own server answers at a path; null while the phone has no line to it. */
export type Ask = (environmentId: string, path: string) => Promise<Response | null>;

/** The most Cells shown under a question; the rest are counted. */
const PILLS = 6;
/** The questions whose Cells are held. */
const HELD = 80;

/** By machine and message: its answer, or null while it is read, read as nothing, or failed. */
let held: ReadonlyMap<string, RecallAnswer | null> = new Map();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const keyOf = (environmentId: string, messageId: string) => `${environmentId}/${messageId}`;

function hold(key: string, answer: RecallAnswer | null): void {
  const next = new Map(held).set(key, answer);
  if (next.size > HELD) next.delete(next.keys().next().value!);
  held = next;
  if (answer !== null) for (const listener of listeners) listener();
}

/**
 * Reads the Cells `text` asks about, once per message; `at` is when it was sent, so "yesterday"
 * under an old question stays the day before it.
 */
export async function readRecallOf(
  environmentId: string,
  messageId: string,
  text: string,
  at: number,
  ask: Ask,
): Promise<void> {
  const key = keyOf(environmentId, messageId);
  if (held.has(key)) return;
  hold(key, null);
  const asked = recallAskOf(text, at);
  if (asked === null) return;
  const query = [
    `query=${encodeURIComponent(asked.query)}`,
    `limit=${PILLS}`,
    ...(asked.from === null ? [] : [`from=${asked.from}`]),
    ...(asked.to === null ? [] : [`to=${asked.to}`]),
  ].join("&");
  try {
    const answer = await ask(environmentId, `${RECALL_PATH}?${query}`);
    if (answer?.ok !== true) return;
    hold(key, (await answer.json()) as RecallAnswer);
  } catch {
    // Out of reach: the question keeps Aski's own answer.
  }
}

/** Every answer held, by `keyOf`; a new map each time one arrives. */
export function useRecallAnswers(): ReadonlyMap<string, RecallAnswer | null> {
  return useSyncExternalStore(subscribe, () => held);
}

/** Forgets every answer: a test starts clean. */
export function forgetRecall(): void {
  held = new Map();
}
