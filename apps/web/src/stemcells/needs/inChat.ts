/**
 * The ask a Cell's own chat docks over its composer, and the spot in the chat it points to
 * (stemcells/tasks/the-ask.md). Plain TypeScript, which the phone imports.
 */
import type { Need, NeedKind, NeedsList } from "./wire";

/** Kinds upstream's chat already answers over the composer: its approval and question panels. */
const CHAT_ANSWERS: ReadonlySet<NeedKind> = new Set(["permission", "question", "input"]);

/** The Cell's own ask, oldest first; null when it has none or the chat already shows it. */
export function chatAskOf(list: NeedsList | null, threadId: string): Need | null {
  let found: Need | null = null;
  for (const need of list?.needs ?? []) {
    if (need.threadId !== threadId || CHAT_ANSWERS.has(need.kind)) continue;
    if (found === null || need.number < found.number) found = need;
  }
  return found;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: string;
  readonly text: string;
}

/** Where the ask stands in the chat: its message, and the words within it when found. */
export interface AskAnchor {
  readonly messageId: string;
  readonly start: number | null;
  readonly end: number | null;
}

/**
 * The Cell's words the ask quotes: the reply's last paragraph, else (a close-out's steps, which
 * the server joins) its first step. A plan, failure or stall points at the Cell's last reply.
 */
export function askAnchorOf(need: Need, messages: ReadonlyArray<ChatMessage>): AskAnchor | null {
  const quotes = need.prose === null ? [] : [need.prose.text, ...need.prose.steps];
  let last: ChatMessage | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "assistant" || message.text.trim() === "") continue;
    last ??= message;
    for (const quote of quotes) {
      const words = quote.trim();
      const start = words === "" ? -1 : message.text.lastIndexOf(words);
      if (start >= 0) return { messageId: message.id, start, end: start + words.length };
    }
    if (quotes.length === 0) break;
  }
  return last === null ? null : { messageId: last.id, start: null, end: null };
}
