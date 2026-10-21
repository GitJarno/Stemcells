/**
 * What Enter does with what the reader found (stemcells/tasks/aski-room.md,
 * decision 8): each answer goes into its card's hold, an option only a click
 * may choose stays lit on its card, and the words that answered nothing stay
 * in the composer, marked. What the parts leave goes to Aski.
 */
import type { Span } from "../../words/text";
import type { CardOption } from "../card";
import type { Answers, Reading } from "./read";

export type Sent = Extract<Reading, { readonly kind: "option" | "answer" }>;

export interface Enter {
  /** Answers for the holds, by card number. */
  readonly answers: ReadonlyArray<{ readonly number: number; readonly reading: Sent }>;
  /** Cards whose chats open. */
  readonly opens: ReadonlyArray<number>;
  /** Options only a click may choose, lit on their cards until then. */
  readonly clicks: ReadonlyArray<{ readonly number: number; readonly option: CardOption }>;
  /** Parts whose words stay in the composer. */
  readonly keep: ReadonlyArray<Span>;
  /** What goes to Aski. */
  readonly rest: ReadonlyArray<Span>;
}

/** What Enter does; null when the words answer no card, so they all go to Aski. */
export function enterOf(answers: Answers): Enter | null {
  if (answers.parts.length === 0) return null;
  const sent: Array<Enter["answers"][number]> = [];
  const opens: number[] = [];
  const clicks: Array<Enter["clicks"][number]> = [];
  const keep: Span[] = [];
  for (const part of answers.parts) {
    let unresolved = part.missing !== null;
    for (const { number, reading } of part.targets) {
      if (reading.kind === "option" || reading.kind === "answer") sent.push({ number, reading });
      else if (reading.kind === "open") opens.push(number);
      else if (reading.kind === "click") clicks.push({ number, option: reading.option });
      else unresolved = true;
    }
    if (unresolved) keep.push({ start: part.start, end: part.end });
  }
  return { answers: sent, opens, clicks, keep, rest: answers.rest };
}
