/**
 * Projects named in a message, and where the sentence points them. Ported
 * from the Swift app's `PlaceResolver`, without its ear: a name is found
 * only as the project is named (the sidebar's name, or an alias learned
 * from the person's own pick), whole words, case aside. Anything less
 * (a prefix, a part, a near spelling, a sound-alike, the other number)
 * is no name at all: "in plain prose" never reads as plain-project. Then
 * the name is graded by its anchor, and only an anchored name routes; see
 * `anchorOf`.
 */

import {
  DETERMINERS,
  FILLERS,
  IN_CUES,
  NOUNS,
  WEAK_CUES,
  type Span,
  type Token,
  after,
  cleanWords,
  countOf,
  crosses,
  lineStart,
} from "./text";

export interface WordsPlace {
  readonly id: string;
  /** The name the person sees, as the sidebar writes it. */
  readonly name: string;
  /** Learned only from the person's own picks, never from a guess. */
  readonly aliases?: readonly string[];
}

export interface RosterPlace {
  readonly place: WordsPlace;
  /** The name's words joined, lowercased: "Harbor Design" → "harbordesign". */
  readonly joined: string;
  /** The name's words, as the words must say them: "harbor design". */
  readonly said: string;
  /** The aliases' words, the same way. */
  readonly aliases: readonly string[];
  /** The name starts with a capital: a mention must be written that way too. */
  readonly capital: boolean;
}

export interface Roster {
  readonly places: readonly RosterPlace[];
}

/**
 * A name's words: camel humps split, a [bracket note] removed, a possessive
 * shed, dashes and underscores as spaces. "PriceDrop" → "price drop".
 */
export function nameWords(name: string): string[] {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** Build once per roster change. */
export function roster(places: readonly WordsPlace[]): Roster {
  return {
    places: places.map((place) => {
      const words = nameWords(place.name);
      return {
        place,
        joined: words.join(""),
        said: words.join(" "),
        aliases: (place.aliases ?? [])
          .map((a) => nameWords(a).join(" "))
          .filter((a) => a.length > 0),
        capital: /^\p{Lu}/u.test(place.name.trim()),
      };
    }),
  };
}

export type PlaceAnchor =
  /** The first words of a line, after nothing but leads: "Harbor fix the header". */
  | "address"
  /** A pointer: "in Atlas", "the Atlas repo", "Atlas Cells", "a Cell for Atlas". */
  | "cue"
  /** The name is all the message says: "Atlas". */
  | "whole"
  /** "for/on/at Atlas": may be about Atlas, not in it. Never routes. */
  | "weak"
  | "none";

export interface PlaceHit extends Span {
  readonly place: RosterPlace;
  /** "alias": a name the person taught by their own pick. */
  readonly kind: "exact" | "alias";
  /** The words as typed. */
  readonly heard: string;
  /** Token indexes, first and last. */
  readonly first: number;
  readonly last: number;
  readonly anchor: PlaceAnchor;
}

/**
 * Every project the words name, at most one per stretch of words, the
 * longer name first at the same place ("Harbor Design" over Harbor).
 */
export function placeHits(
  text: string,
  tokens: readonly Token[],
  places: Roster,
  blocked: (start: number, end: number) => boolean,
  isLead: (word: string) => boolean,
): PlaceHit[] {
  type Raw = Omit<PlaceHit, "anchor">;
  const raw: Raw[] = [];
  for (let width = 1; width <= 3; width++) {
    for (let i = 0; i + width <= tokens.length; i++) {
      const gram = tokens.slice(i, i + width);
      if (gram.some((t) => t.literal)) continue;
      if (width > 1 && crosses(text, tokens, i, i + width - 1)) continue;
      const start = gram[0]!.start;
      const end = gram[width - 1]!.end;
      if (blocked(start, end)) continue;
      // Whole words, as the name has them: "harbor-design" and
      // "HarborDesign" are Harbor Design, "bright lane" isn't Brightlane.
      const said = gram.flatMap((t) => nameWords(t.raw)).join(" ");
      if (said.length < 2) continue;
      for (const p of places.places) {
        const kind = said === p.said ? "exact" : p.aliases.includes(said) ? "alias" : null;
        if (kind)
          raw.push({
            start,
            end,
            place: p,
            kind,
            heard: text.slice(start, end),
            first: i,
            last: i + width - 1,
          });
      }
    }
  }
  raw.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const kept: Raw[] = [];
  for (const h of raw) if (!kept.some((k) => k.start < h.end && h.start < k.end)) kept.push(h);
  return kept
    .sort((a, b) => a.start - b.start)
    .map((h) => ({ ...h, anchor: anchorOf(text, h, isLead) }));
}

/** Where the sentence points a name: the anchor ladder. */
export function anchorOf(text: string, hit: Span, isLead: (word: string) => boolean): PlaceAnchor {
  const before = cleanWords(text.slice(lineStart(text, hit.start), hit.start));
  const next = after(text, hit.end);
  if (before.length <= 4 && before.every(isLead) && !(next.word && DETERMINERS.has(next.word)))
    return "address";
  const back = before.slice();
  if (back.length > 0 && DETERMINERS.has(back[back.length - 1]!)) back.pop();
  const last = back[back.length - 1];
  if (last && IN_CUES.has(last)) return "cue";
  if (next.word && NOUNS.has(next.word)) return "cue";
  if (last === "for") {
    const prior = back[back.length - 2];
    if (prior && (NOUNS.has(prior) || countOf(prior) > 0)) return "cue";
  }
  const residue = cleanWords(`${text.slice(0, hit.start)} ${text.slice(hit.end)}`).filter(
    (w) => !FILLERS.has(w),
  );
  if (residue.length === 0) return "whole";
  if (last && WEAK_CUES.has(last)) return "weak";
  return "none";
}
