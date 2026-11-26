/**
 * "Where it asked" (stemcells/tasks/the-ask.md, decision 4): the docked ask's words as one of
 * upstream's citations, which the chat's timeline unfolds, scrolls to and highlights when the
 * route's hash names it. `askCitation.contract.test.ts` pins that the timeline finds them.
 */
import { useAtomValue } from "@effect/atom-react";
import type { AssistantCitation, EnvironmentId, MessageId, ThreadId } from "@t3tools/contracts";
import {
  createAssistantTextSelector,
  formatAssistantCitationHref,
  parseAssistantCitationHref,
} from "@t3tools/shared/assistantCitations";
import { useNavigate } from "@tanstack/react-router";

import { assistantCitationNavigation } from "../../lib/assistantCitationNavigation";
import { captureAssistantMessageOpening } from "../../lib/assistantTextSelection";
import { useQuietThreadShell } from "../../state/entities";
import { environmentThreadDetails } from "../../state/threads";
import { askAnchorOf, type AskAnchor, type ChatMessage } from "../needs/inChat";
import { plainOf } from "../needs/inline";
import type { Need } from "../needs/wire";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/**
 * The anchor as a citation of its message. The timeline matches a citation against the text
 * it draws, so the words are taken without their markup; an anchor with no words cites the
 * message's opening.
 */
export function askCitationOf(
  thread: { readonly environmentId: string; readonly threadId: string },
  anchor: AskAnchor,
  text: string,
): AssistantCitation | null {
  const plain = plainOf(text);
  const selector =
    anchor.start === null || anchor.end === null
      ? captureAssistantMessageOpening(null, plain)
      : (() => {
          const start = plainOf(text.slice(0, anchor.start)).length;
          const end = start + plainOf(text.slice(anchor.start, anchor.end)).length;
          return createAssistantTextSelector(plain, start, end);
        })();
  if (selector === null) return null;
  return {
    version: 1,
    environmentId: thread.environmentId as EnvironmentId,
    threadId: thread.threadId as ThreadId,
    messageId: anchor.messageId as MessageId,
    ...selector,
  };
}

/**
 * Jumps the Cell's chat to where `need` asked, highlighting its words; null while the chat has
 * no reply to point at. Reads the items the timeline draws, which hold still while a reply
 * streams, so nothing here runs per streamed word.
 */
export function useAskJump(cell: CellRef, need: Need): (() => void) | null {
  const thread = threadRefOf(cell);
  const href = useAtomValue(
    environmentThreadDetails.timelineVisibleTurnItemsAtom(thread),
    (items) => {
      const messages = items.flatMap(({ item }): ChatMessage[] =>
        item.type === "assistant_message" || item.type === "user_message"
          ? [
              {
                id: item.messageId,
                role: item.type === "assistant_message" ? "assistant" : "user",
                text: item.text,
              },
            ]
          : [],
      );
      const anchor = askAnchorOf(need, messages);
      const text = messages.find((message) => message.id === anchor?.messageId)?.text;
      const citation =
        anchor === null || text === undefined ? null : askCitationOf(cell, anchor, text);
      return citation === null ? null : formatAssistantCitationHref(citation);
    },
  );
  const navigate = useNavigate();
  const sourceThread = useQuietThreadShell(thread);
  if (href === null) return null;
  return () => {
    const citation = parseAssistantCitationHref(href);
    if (citation !== null) void navigate(assistantCitationNavigation(citation, sourceThread));
  };
}
