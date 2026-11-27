/**
 * The ask a Cell's own chat ends on, and the words in the chat it was built from
 * (stemcells/tasks/the-ask.md). Plain TypeScript, which the phone imports.
 */
import { askOf } from "./card";
import type { Need, NeedKind, NeedsList } from "./wire";

/** Kinds upstream's chat already answers over the composer: its approval, question and limit panels. */
const CHAT_ANSWERS: ReadonlySet<NeedKind> = new Set(["permission", "question", "input", "limit"]);

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

/**
 * Words of a reply an ask was built from: a step the Cell left the person ("you"), the Cell's
 * own step that waits on it ("next"), or the sentence that asks ("ask"). `index` is the step's
 * place among its kind, as the card lists them; offsets are into the reply's markdown.
 */
export interface AskPassage {
  readonly kind: "you" | "next" | "ask";
  readonly index: number;
  readonly start: number;
  readonly end: number;
}

/** Where an ask stands in the chat: its reply, and the passages found in it. */
export interface AskPlace {
  readonly messageId: string;
  readonly passages: ReadonlyArray<AskPassage>;
}

/** The server joins a close-out's steps of one owner with this (`stemcells/closeOut`). */
const STEPS_JOINED = " · ";

/** The words each passage quotes, by kind, in the card's order. */
function quotesOf(need: Need): ReadonlyArray<{ kind: AskPassage["kind"]; words: string[] }> {
  const prose = need.prose;
  if (need.kind !== "prose" || prose === null) return [];
  if (prose.cue === "left")
    return [
      { kind: "you", words: prose.steps.length > 0 ? [...prose.steps] : [prose.text] },
      { kind: "next", words: prose.next === null ? [] : prose.next.split(STEPS_JOINED) },
    ];
  const asked = prose.cue === "stopped" ? null : askOf(prose.text);
  return [{ kind: "ask", words: [asked?.ask ?? prose.text] }];
}

/** The passages of `text` the ask quotes, in reading order; each the last place its words stand. */
export function askPassagesIn(need: Need, text: string): ReadonlyArray<AskPassage> {
  const found: AskPassage[] = [];
  for (const { kind, words } of quotesOf(need))
    words.forEach((each, index) => {
      const quote = each.trim();
      const start = quote === "" ? -1 : text.lastIndexOf(quote);
      if (start >= 0) found.push({ kind, index, start, end: start + quote.length });
    });
  return found.sort((a, b) => a.start - b.start);
}

/**
 * The latest reply holding words the ask quotes, and those passages. A plan, failure or stall
 * quotes none, and an ask whose words no reply holds points at the last reply whole.
 */
export function askPlaceOf(need: Need, messages: ReadonlyArray<ChatMessage>): AskPlace | null {
  const quotes = quotesOf(need).length > 0;
  let last: string | null = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "assistant" || message.text.trim() === "") continue;
    last ??= message.id;
    if (!quotes) break;
    const passages = askPassagesIn(need, message.text);
    if (passages.length > 0) return { messageId: message.id, passages };
  }
  return last === null ? null : { messageId: last, passages: [] };
}
