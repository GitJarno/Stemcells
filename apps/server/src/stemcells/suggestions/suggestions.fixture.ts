import { MessageId, ProviderInstanceId, RunId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import type { SuggestionMessage, SuggestionRun } from "../upstream/suggestions.ts";

/** Run `ordinal`, begun at `beganAt` (epoch ms) on `instance`, its message `ask-<ordinal>`. */
export const run = (
  ordinal: number,
  status: SuggestionRun["status"],
  beganAt: number,
  instance = "codex",
  completedAt: number | null = status === "completed" ? beganAt + 30_000 : null,
): SuggestionRun => ({
  id: RunId.make(`run-${ordinal}`),
  ordinal,
  status,
  providerInstanceId: ProviderInstanceId.make(instance),
  userMessageId: MessageId.make(`ask-${ordinal}`),
  requestedAt: DateTime.makeUnsafe(beganAt),
  startedAt: DateTime.makeUnsafe(beganAt),
  completedAt: completedAt === null ? null : DateTime.makeUnsafe(completedAt),
});

export const message = (
  id: string,
  role: SuggestionMessage["role"],
  text: string,
  createdAt: number,
): SuggestionMessage => ({
  id: MessageId.make(id),
  role,
  text,
  streaming: false,
  createdAt: DateTime.makeUnsafe(createdAt),
});
