/**
 * What a Cell started from words is sent: the message without its setup
 * words ("Harbor fix the header with Opus at max" sends "Fix the header"),
 * or its [bracket] word for word. The draft's text becomes that just
 * before upstream's send reads it, and comes back if nothing was sent.
 * `stemcells/tasks/prompting.md`, decision 9.
 */

import { createContext } from "react";

import type { Facts } from "./read";
import type { Span } from "./text";

/**
 * Called as the composer sends: makes the text what is sent, and returns
 * what to do once the send settles (with what upstream's send returned),
 * or null when the words change nothing.
 */
export type BeforeSend = () => ((sent: unknown) => void) | null;

/** How the composer's words hand the composer their `BeforeSend` (null to take it back). */
export const WordsSendSlot = createContext<((beforeSend: BeforeSend | null) => void) | null>(null);

/** What the one Cell the words start is sent; null when it is the text as written. */
export function outgoingOf(facts: Facts): string | null {
  if (facts.cell !== null || facts.cells.length !== 1 || facts.grammar.length === 0) return null;
  const part = facts.cells[0]!.part;
  const out = part.kind === "verbatim" ? facts.verbatims[part.index]!.text : facts.task;
  return out.length === 0 || out === facts.text.trim() ? null : out;
}

/** Replace `[start, end)` with `insert`. */
export interface Edit extends Span {
  readonly insert: string;
}

/**
 * Edits that make `from` read `to`, when `to` is `from` with characters
 * left out, a letter's case changed or a space put in (what tidying the
 * setup words away does). Every character `to` keeps stays where it was,
 * so a chip or a formatted word keeps its place. Null when `to` isn't such
 * a reading of `from`.
 */
export function editsToward(from: string, to: string): Edit[] | null {
  const edits: Edit[] = [];
  let i = 0;
  for (const c of to) {
    let k = i;
    while (k < from.length && !sameLetter(from[k]!, c)) k++;
    if (k === from.length) {
      if (!/\s/.test(c)) return null;
      edits.push({ start: i, end: i, insert: c });
      continue;
    }
    if (k > i) edits.push({ start: i, end: k, insert: "" });
    if (from[k] !== c) edits.push({ start: k, end: k + 1, insert: c });
    i = k + 1;
  }
  if (i < from.length) edits.push({ start: i, end: from.length, insert: "" });
  return edits;
}

const sameLetter = (a: string, b: string) =>
  a === b || (/\p{L}/u.test(b) && a.toLowerCase() === b.toLowerCase());

/** `text` with the edits made: what the composer will hold. */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const e of edits.toSorted((a, b) => b.start - a.start || b.end - a.end))
    out = out.slice(0, e.start) + e.insert + out.slice(e.end);
  return out;
}
