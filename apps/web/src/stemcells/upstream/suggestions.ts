// What the next-prompt suggestion takes from upstream's web: the composer's
// and its editor's props (the thread, its messages, what the composer waits
// on), the hint its placeholder gives when nothing else is asked of the
// person, its key look, and the thread's own server, as upstream reaches it
// (`machines.ts`).

import { type EnvironmentId, MessageId, type ThreadId } from "@t3tools/contracts";

import type {
  ComposerPromptEditorHandle,
  ComposerPromptEditorProps,
} from "../../components/ComposerPromptEditor";
import type { ChatComposerProps } from "../../components/chat/ChatComposer";
import type { ChatMessage, SessionPhase } from "../../types";
import { callMachine } from "./machines";

export type {
  ChatComposerProps,
  ChatMessage,
  ComposerPromptEditorHandle,
  ComposerPromptEditorProps,
  EnvironmentId,
  SessionPhase,
  ThreadId,
};
export { MessageId };
export { Kbd } from "../../components/ui/kbd";

/**
 * Upstream's placeholder when the composer asks nothing else of the person;
 * the only one a suggestion stands in for (`suggestions.contract.test.ts`).
 */
export const IDLE_PLACEHOLDER = "Ask anything, @tag files/folders, $use skills, or / for commands";

const SUGGESTION_PATH = "/api/stemcells/prompt-suggestion";

/**
 * What the thread's server suggests the person say after `afterMessageId`;
 * null when it has nothing, or can't be reached (a server without
 * Stemcells, or one reached through the relay). Never throws.
 */
export async function askSuggestion(
  environmentId: EnvironmentId,
  threadId: ThreadId,
  afterMessageId: MessageId,
): Promise<string | null> {
  const answer = await callMachine(environmentId, SUGGESTION_PATH, { threadId, afterMessageId });
  if (!answer.ok || answer.status !== 200) return null;
  const suggestion =
    typeof answer.body === "object" && answer.body !== null && "suggestion" in answer.body
      ? answer.body.suggestion
      : null;
  return typeof suggestion === "string" && suggestion.trim().length > 0 ? suggestion.trim() : null;
}
