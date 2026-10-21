/**
 * What Enter does with what the reader found (stemcells/tasks/aski-room.md,
 * decision 8): each answer goes into its card's hold, an option only a click
 * may choose stays lit on its card, and the words that answered nothing stay
 * in the composer, marked. What the parts leave goes to Aski.
 */
import type { Span } from "../../words/text";
import type { CardOption } from "../card";
import type { AnswerPart, Answers, Reading } from "./read";

export type Sent = Extract<Reading, { readonly kind: "option" | "answer" }>;

export interface Enter {
  /**
   * Answers for the holds, by card number, each with the words that said
   * it after the card's number: they go back to the composer if it isn't
   * sent (`giveBack.ts`).
   */
  readonly answers: ReadonlyArray<{
    readonly number: number;
    readonly reading: Sent;
    readonly said: Span;
  }>;
  /** Cards whose chats open. */
  readonly opens: ReadonlyArray<number>;
  /** Options only a click may choose, lit on their cards until then. */
  readonly clicks: ReadonlyArray<{ readonly number: number; readonly option: CardOption }>;
  /** Parts whose words stay in the composer. */
  readonly keep: ReadonlyArray<Span>;
  /** What goes to Aski. */
  readonly rest: ReadonlyArray<Span>;
}

/** The words a part says to one card: from past what named it to where its answer ends. */
function saidTo(text: string, part: AnswerPart, end: number): Span {
  let start = part.anchor.end;
  while (start < end && /[\s,.:;]/.test(text[start]!)) start++;
  return { start, end };
}

/** What Enter does; null when the words answer no card, so they all go to Aski. */
export function enterOf(answers: Answers, text: string): Enter | null {
  if (answers.parts.length === 0) return null;
  const sent: Array<Enter["answers"][number]> = [];
  const opens: number[] = [];
  const clicks: Array<Enter["clicks"][number]> = [];
  const keep: Span[] = [];
  for (const part of answers.parts) {
    let unresolved = part.missing !== null;
    for (const { number, reading, end } of part.targets) {
      if (reading.kind === "option" || reading.kind === "answer")
        sent.push({ number, reading, said: saidTo(text, part, end) });
      else if (reading.kind === "open") opens.push(number);
      else if (reading.kind === "click") clicks.push({ number, option: reading.option });
      else unresolved = true;
    }
    if (unresolved) keep.push({ start: part.start, end: part.end });
  }
  return { answers: sent, opens, clicks, keep, rest: answers.rest };
}
