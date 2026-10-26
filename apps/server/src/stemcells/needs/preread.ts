/**
 * The pre-read (stemcells/tasks/aski-room.md, "Item types"): free code that says whether a
 * Cell's finished reply leaves something to the person, from its last paragraph. A question,
 * an offer to go on, or a stop short of done makes a card; anything else is a report, which
 * T3 already shows as done.
 */

/** "left": the Cell's own close-out names a step that is the person's (`closeOut.ts`). */
export type Cue = "question" | "offer" | "stopped" | "left";

export interface PreRead {
  readonly cue: Cue;
  /** The reply's last paragraph, word for word: what the card quotes. */
  readonly text: string;
}

/** A card quotes at most this much, from the end, where the ask is. */
export const QUOTE_CAP = 1_000;

/** A question mark that ends a sentence, not one inside a word or a path. */
const QUESTION = /\?(?=[\s"'”’)\]*_]|$)/;
/** Asks a yes answers ("Want me to push it?"); "Go ahead." fits them. */
const OFFER =
  /\b(?:want me to|should i|shall i|would you like me to|if you(?:'d| would) like me to|if you want me to)\b/i;
/** Asks with no question mark. */
const ASK = /\b(?:let me know|your call|up to you)\b/i;
/** The closer most reports end on: not an ask. */
const CLOSER =
  /\blet me know if (?:you (?:have|need|run into|hit|see)|there(?:'s| is| are)|anything)\b/i;
/** A stop short of done: what comes next, or how much is left. */
const STOPPED =
  /\b(?:next,? i(?:'ll| will)|then i(?:'ll| will)|i(?:'ll| will) (?:now |next )?(?:continue|proceed|move on)|\d+ of \d+ (?:are |is )?(?:done|complete|completed|finished)|(?:still|left) to do|not (?:done|finished) yet)\b/i;

const FENCE = /^\s*(?:```|~~~)/;
const LIST_ITEM = /^\s*(?:[-*+•]|\d{1,2}[.)])\s+\S/;

/** The reply without its fenced code: code asks nothing. */
function prose(reply: string): string {
  let inFence = false;
  const kept: string[] = [];
  for (const line of reply.split("\n")) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      kept.push("");
      continue;
    }
    if (!inFence) kept.push(line);
  }
  return kept.join("\n");
}

const isList = (block: string) =>
  block.split("\n").every((line) => LIST_ITEM.test(line) || /^\s{2,}\S/.test(line));

/**
 * The reply's last paragraph. A list that ends the reply comes with the
 * paragraph that leads into it ("Which one?" over the choices).
 */
export function lastParagraph(reply: string): string {
  const blocks = prose(reply)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== "");
  const last = blocks.length - 1;
  if (last < 0) return "";
  const first = last > 0 && isList(blocks[last] ?? "") ? last - 1 : last;
  return blocks.slice(first).join("\n\n");
}

/** The end of a long paragraph, from a word's start: the ask is at the end. */
function quoted(text: string): string {
  if (text.length <= QUOTE_CAP) return text;
  const tail = text.slice(-QUOTE_CAP);
  const start = tail.search(/\s\S/);
  return `…${start < 0 ? tail : tail.slice(start + 1)}`;
}

/** Words only: inline code and links ask nothing either. */
const plain = (text: string) =>
  text
    .replace(/`[^`\n]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_]{1,2}/g, "");

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== "");

const asks = (sentence: string) =>
  QUESTION.test(sentence) || OFFER.test(sentence) || (ASK.test(sentence) && !CLOSER.test(sentence));
const offers = (sentence: string) => OFFER.test(sentence) && !/\bor\b/i.test(sentence);

/** What the reply leaves to the person, or null for a report. */
export function preRead(reply: string): PreRead | null {
  const paragraph = lastParagraph(reply);
  if (paragraph === "") return null;
  const words = plain(paragraph);
  const ask = sentences(words).filter(asks);
  if (ask.length > 0) {
    return { cue: ask.every(offers) ? "offer" : "question", text: quoted(paragraph) };
  }
  return STOPPED.test(words) ? { cue: "stopped", text: quoted(paragraph) } : null;
}
