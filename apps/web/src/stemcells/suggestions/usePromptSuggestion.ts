import { createContext, useEffect, useReducer, useState } from "react";

import {
  askSuggestion,
  type ChatComposerProps,
  type ChatMessage,
  type EnvironmentId,
  type MessageId,
  type SessionPhase,
  type ThreadId,
} from "../upstream/suggestions";
import { useSuggestionsOn } from "./switch";

/** What a composer shows the person might say next, and how they wave it off. */
export interface PromptSuggestion {
  readonly text: string;
  /** Hides it until the Cell replies again. */
  readonly dismiss: () => void;
}

/** The chat's suggestion, from its composer to its editor; null when there's none to show. */
export const PromptSuggestionContext = createContext<PromptSuggestion | null>(null);

/**
 * The reply a suggestion would follow: the chat's last message, once the
 * Cell is done and it is a finished reply. Null while the Cell works, after
 * the person's own message, or when the last word is the app's.
 */
export function replyToFollow(
  messages: ReadonlyArray<Pick<ChatMessage, "id" | "role" | "streaming">>,
  phase: SessionPhase,
): MessageId | null {
  if (phase !== "ready") return null;
  const last = messages.at(-1);
  return last?.role === "assistant" && !last.streaming ? last.id : null;
}

/** Answers this page has, by reply; a reply's answer is asked for once. */
const asked = new Map<string, Promise<string | null>>();
const ASKED_MOST = 200;
/** Replies whose suggestion the person waved off. */
const dismissed = new Set<string>();

function ask(environmentId: EnvironmentId, threadId: ThreadId, replyId: MessageId, key: string) {
  const known = asked.get(key);
  if (known !== undefined) return known;
  const answer = askSuggestion(environmentId, threadId, replyId);
  asked.set(key, answer);
  // An empty answer may be the server not yet seeing the reply settle: the next look asks again.
  void answer.then((text) => {
    if (text === null) asked.delete(key);
  });
  if (asked.size > ASKED_MOST) {
    const oldest = asked.keys().next();
    if (oldest.done !== true) asked.delete(oldest.value);
  }
  return answer;
}

/**
 * The suggestion for the chat a composer shows, once its Cell has replied
 * and nothing else is asked of the person: no approval, question or plan
 * waits, and the person may act in the chat.
 */
export function usePromptSuggestion(props: ChatComposerProps): PromptSuggestion | null {
  const on = useSuggestionsOn();
  const replyId = replyToFollow(props.promptHistoryMessages, props.phase);
  const asking =
    on &&
    replyId !== null &&
    props.routeKind === "server" &&
    props.activeThreadId !== null &&
    props.canOperateThread &&
    props.activePendingApproval === null &&
    props.activePendingProgress === null &&
    !(props.showPlanFollowUpPrompt && props.activeProposedPlan !== null);
  const threadId = props.activeThreadId;
  const key = asking ? JSON.stringify([props.environmentId, threadId, replyId]) : null;

  const [answer, setAnswer] = useState<{ readonly key: string; readonly text: string } | null>(
    null,
  );
  const [, waved] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (key === null || threadId === null || replyId === null) return;
    let live = true;
    void ask(props.environmentId, threadId, replyId, key).then((text) => {
      if (live && text !== null) setAnswer({ key, text });
    });
    return () => {
      live = false;
    };
  }, [key, props.environmentId, threadId, replyId]);

  if (key === null || answer?.key !== key || dismissed.has(key)) return null;
  return {
    text: answer.text,
    dismiss: () => {
      dismissed.add(key);
      waved();
    },
  };
}
