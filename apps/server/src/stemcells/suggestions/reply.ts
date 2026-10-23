import type { MessageId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import {
  runStartedAt,
  type SuggestionMessage,
  type SuggestionRun,
} from "../upstream/suggestions.ts";
import { USER_MESSAGES_READ } from "./prompt.ts";

// Which reply a suggestion is for: the thread's last, once its run has
// completed and nothing waits behind it.

const UNSETTLED: ReadonlySet<SuggestionRun["status"]> = new Set([
  "preparing",
  "queued",
  "starting",
  "running",
  "waiting",
]);

const byOrdinal = (a: SuggestionRun, b: SuggestionRun) => a.ordinal - b.ordinal;
const startedMs = (run: SuggestionRun) => DateTime.toEpochMillis(runStartedAt(run));

/**
 * The thread's last run, when it completed and no run is under way or
 * queued; null otherwise. A rolled-back run is gone from the conversation.
 * One that failed or was stopped gets no suggestion, as Claude Code gives
 * none after an error.
 */
export function lastCompletedRun(runs: ReadonlyArray<SuggestionRun>): SuggestionRun | null {
  if (runs.some((run) => UNSETTLED.has(run.status))) return null;
  const last = runs
    .filter((run) => run.status !== "rolled_back")
    .toSorted(byOrdinal)
    .at(-1);
  return last?.status === "completed" ? last : null;
}

/** The person's messages the short call reads: those that started the last few runs, oldest first. */
export function recentUserMessageIds(
  runs: ReadonlyArray<SuggestionRun>,
  run: SuggestionRun,
): ReadonlyArray<MessageId> {
  return runs
    .filter((other) => other.status !== "rolled_back" && other.ordinal <= run.ordinal)
    .toSorted(byOrdinal)
    .slice(-USER_MESSAGES_READ)
    .map((other) => other.userMessageId);
}

/** The run's last reply, when it is `afterMessageId` and done streaming; null otherwise. */
export function settledReply(
  replies: ReadonlyArray<SuggestionMessage>,
  afterMessageId: MessageId,
): string | null {
  const last = replies
    .filter((message) => message.role === "assistant")
    .toSorted((a, b) => DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt))
    .at(-1);
  if (last === undefined || last.id !== afterMessageId || last.streaming) return null;
  const text = last.text.trim();
  return text.length > 0 ? text : null;
}

/**
 * Whether a provider's suggestion that came at `at` (epoch ms) follows
 * `run`: it came after the run began, and no other run, rolled back or
 * not, began in between.
 */
export function follows(
  runs: ReadonlyArray<SuggestionRun>,
  run: SuggestionRun,
  at: number,
): boolean {
  const began = startedMs(run);
  return (
    began <= at &&
    !runs.some((other) => {
      if (other.id === run.id) return false;
      const otherBegan = startedMs(other);
      return otherBegan > began && otherBegan <= at;
    })
  );
}
