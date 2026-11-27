/**
 * The words of the Cell's reply its ask was built from (stemcells/tasks/the-ask.md, decision 4),
 * as upstream's citations: painted in the reply with the CSS Custom Highlight API while the ask
 * is open, and jumped to as upstream's timeline unfolds, scrolls to and pulses a cited quote.
 * `askCitation.contract.test.ts` pins that upstream's text finder finds them.
 */
import { useAtomValue } from "@effect/atom-react";
import type { AssistantCitation, EnvironmentId, MessageId, ThreadId } from "@t3tools/contracts";
import { createAssistantTextSelector } from "@t3tools/shared/assistantCitations";
import { useNavigate } from "@tanstack/react-router";
import { type RefObject, useEffect } from "react";

import { assistantCitationNavigation } from "../../lib/assistantCitationNavigation";
import {
  captureAssistantMessageOpening,
  resolveAssistantCitationRange,
} from "../../lib/assistantTextSelection";
import { useQuietThreadShell } from "../../state/entities";
import { environmentThreadDetails } from "../../state/threads";
import { askPlaceOf, type AskPassage, type ChatMessage } from "../needs/inChat";
import { plainOf } from "../needs/inline";
import type { Need } from "../needs/wire";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

type Thread = { readonly environmentId: string; readonly threadId: string };

/**
 * Words of a message as one of its citations. The timeline matches a citation against the text
 * it draws, so the words are taken without their markup; no words cite the message's opening.
 */
export function askCitationOf(
  thread: Thread,
  messageId: string,
  text: string,
  words: { readonly start: number; readonly end: number } | null,
): AssistantCitation | null {
  const plain = plainOf(text);
  const selector =
    words === null
      ? captureAssistantMessageOpening(null, plain)
      : (() => {
          const start = plainOf(text.slice(0, words.start)).length;
          const end = start + plainOf(text.slice(words.start, words.end)).length;
          return createAssistantTextSelector(plain, start, end);
        })();
  if (selector === null) return null;
  return {
    version: 1,
    environmentId: thread.environmentId as EnvironmentId,
    threadId: thread.threadId as ThreadId,
    messageId: messageId as MessageId,
    ...selector,
  };
}

export interface AskMark {
  readonly passage: AskPassage;
  readonly citation: AssistantCitation;
}

/** The ask's place in its chat: each passage found, cited, and the reply whole for the rest. */
export interface AskMarks {
  readonly marks: ReadonlyArray<AskMark>;
  readonly whole: AssistantCitation | null;
}

/**
 * Where `need` stands in the Cell's chat; null while the chat has no reply. Reads the items the
 * timeline draws, which hold still while a reply streams, so nothing here runs per streamed word.
 */
export function useAskMarks(cell: CellRef, need: Need): AskMarks | null {
  const thread = threadRefOf(cell);
  const json = useAtomValue(
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
      const place = askPlaceOf(need, messages);
      const text = messages.find((message) => message.id === place?.messageId)?.text;
      if (place === null || text === undefined) return null;
      const marks = place.passages.flatMap((passage): AskMark[] => {
        const citation = askCitationOf(cell, place.messageId, text, passage);
        return citation === null ? [] : [{ passage, citation }];
      });
      // A string, so the chat's every item update that moves nothing here draws nothing.
      return JSON.stringify({ marks, whole: askCitationOf(cell, place.messageId, text, null) });
    },
  );
  return json === null ? null : (JSON.parse(json) as AskMarks);
}

/** Jumps the Cell's chat to a citation, as a cited quote's link does. */
export function useJumpTo(cell: CellRef): (citation: AssistantCitation) => void {
  const navigate = useNavigate();
  const sourceThread = useQuietThreadShell(threadRefOf(cell));
  return (citation) => void navigate(assistantCitationNavigation(citation, sourceThread));
}

/** The person's steps and the asking sentence take one ink; the Cell's own next step a softer one. */
const HIGHLIGHT_OF: Readonly<Record<AskPassage["kind"], string>> = {
  you: "stemcells-ask-you",
  ask: "stemcells-ask-you",
  next: "stemcells-ask-next",
};

/**
 * Paints `marks` in the reply while the element at `near` sits in the same timeline. The list
 * mounts a reply again as it scrolls back into view, so a mark whose words left the page is
 * found again on the next frame the timeline's rows change; a mark keeps its range until then.
 */
export function useAskHighlights(
  near: RefObject<HTMLElement | null>,
  marks: ReadonlyArray<AskMark>,
): void {
  // By value: the marks are parsed afresh each render.
  const key = JSON.stringify(marks);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Paint the reply's passages through the browser's highlight registry, and take them back when the ask or its words change.
  useEffect(() => {
    const shown = JSON.parse(key) as ReadonlyArray<AskMark>;
    const viewport = near.current?.closest<HTMLElement>("[data-assistant-citation-viewport]");
    if (viewport == null || shown.length === 0) return;
    return paint(viewport, shown);
  }, [key, near]);
}

function paint(viewport: HTMLElement, marks: ReadonlyArray<AskMark>): () => void {
  const registry = typeof CSS === "undefined" ? undefined : CSS.highlights;
  if (registry === undefined || typeof Highlight === "undefined") return () => {};
  const painted = marks.map((mark) => ({
    mark,
    name: HIGHLIGHT_OF[mark.passage.kind],
    source: null as HTMLElement | null,
    range: null as Range | null,
  }));
  const highlightOf = (name: string) => {
    const existing = registry.get(name);
    if (existing !== undefined) return existing;
    const made = new Highlight();
    registry.set(name, made);
    return made;
  };
  const unpaint = (each: (typeof painted)[number]) => {
    if (each.range === null) return;
    const highlight = registry.get(each.name);
    highlight?.delete(each.range);
    if (highlight?.size === 0) registry.delete(each.name);
    each.range = null;
  };
  let frame = 0;
  const repaint = () => {
    frame = 0;
    for (const each of painted) {
      if (each.range !== null && each.source?.isConnected && !each.range.collapsed) continue;
      unpaint(each);
      const { messageId } = each.mark.citation;
      each.source = viewport.querySelector<HTMLElement>(
        `[data-assistant-citation-source="${CSS.escape(messageId)}"]`,
      );
      each.range =
        each.source === null
          ? null
          : resolveAssistantCitationRange(each.source, each.mark.citation);
      if (each.range !== null) highlightOf(each.name).add(each.range);
    }
  };
  repaint();
  const observer = new MutationObserver(() => {
    if (frame === 0) frame = requestAnimationFrame(repaint);
  });
  observer.observe(viewport, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    painted.forEach(unpaint);
  };
}
