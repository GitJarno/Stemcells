/**
 * Tab completes a project at the address: after three letters of the
 * message's (or a line's) first word, with the caret at the end of it, the
 * rest of the best name shows as a ghost, and Tab writes it. Ported from the
 * Swift app's `PlaceCompletion`. `stemcells/tasks/prompting.md`, decision 7.
 */

import type { Roster, RosterPlace } from "./places";
import { cleanWords, lineStart } from "./text";

export interface Completion {
  /** Where the typed part of the name starts. */
  readonly start: number;
  /** The caret: where the rest goes. */
  readonly at: number;
  readonly place: RosterPlace;
  /** The rest of the name, as the project writes it. */
  readonly rest: string;
}

/**
 * The completion for the caret, or null. `isLead` says which words may
 * stand before the address ("spawn", "3", "Opus"); `recency` ranks the
 * candidates, the most recently used first.
 */
export function completionAt(
  text: string,
  caret: number,
  roster: Roster,
  isLead: (word: string) => boolean,
  recency: (place: RosterPlace) => number,
): Completion | null {
  if (caret < text.length && !/\s/.test(text[caret]!)) return null;
  if (caret === 0 || /\s/.test(text[caret - 1]!)) return null;
  // The address word: the first on the line after the leads.
  const from = lineStart(text, caret);
  let start = from;
  for (const m of text.slice(from, caret).matchAll(/\S+/g)) {
    start = from + m.index;
    const word = cleanWords(m[0])[0];
    if (word === undefined || !isLead(word)) break;
    start = from + m.index + m[0].length;
  }
  if (start >= caret) return null;
  const typed = text.slice(start, caret);
  if (typed.replace(/[^\p{L}]/gu, "").length < 3 || typed.includes(":")) return null;
  const lower = typed.toLowerCase();
  const names = roster.places.filter((p) => p.place.name.toLowerCase().startsWith(lower));
  if (names.some((p) => p.place.name.toLowerCase() === lower)) return null;
  const best = names.sort(
    (a, b) => recency(b) - recency(a) || a.place.name.length - b.place.name.length,
  )[0];
  if (best === undefined) return null;
  return { start, at: caret, place: best, rest: best.place.name.slice(typed.length) };
}
