/**
 * Projects named in a message, and where the sentence points them. Ported
 * from the Swift app's `PlaceResolver`: a name is found exactly, by a
 * learned alias, or by ear (a Metaphone key or a near spelling), and then
 * graded by its anchor. Only an anchored name routes; see `anchorOf`.
 */

import { jaroWinkler, phoneticKey } from "./phonetic";
import {
  CUE_WORDS,
  DETERMINERS,
  FILLERS,
  IN_CUES,
  NOUNS,
  SPAWN_NOUNS,
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
  readonly key: string;
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
      const joined = nameWords(place.name).join("");
      return {
        place,
        joined,
        key: phoneticKey(joined),
        aliases: (place.aliases ?? [])
          .map((a) => nameWords(a).join(""))
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
  /** "plural": the singular of a plural folder or the other way round ("Lantern", Lanterns). */
  readonly kind: "exact" | "plural" | "alias" | "sound";
  /** 1 for exact; how close the ear's reading is otherwise. */
  readonly score: number;
  /** The words as typed. */
  readonly heard: string;
  /** Token indexes, first and last. */
  readonly first: number;
  readonly last: number;
  readonly anchor: PlaceAnchor;
}

/** The same name in the other number: "lantern" ↔ "lanterns". */
const otherNumber = (joined: string): string =>
  joined.endsWith("s") ? joined.slice(0, -1) : `${joined}s`;

/**
 * Every name the words could mean, at most one per stretch of words, the
 * strongest first: exact over heard, a confident hearing over a weak one,
 * a longer name over a shorter one at the same place.
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
      const joined = gram.map((t) => t.bare).join("");
      if (joined.length < 2) continue;
      // A heard name never ends with a cue or a determiner ("review the" is
      // not Reviews) nor opens with a determiner, and the Cells are never a
      // folder's sound-alike. It may open with a cue: "at less" is Atlas.
      const last = gram[width - 1]!.bare;
      const edgy =
        width > 1 &&
        (CUE_WORDS.has(last) || DETERMINERS.has(last) || DETERMINERS.has(gram[0]!.bare));
      const cells = gram.some((t) => SPAWN_NOUNS.has(t.norm));
      const key = edgy || cells ? "" : phoneticKey(joined);
      for (const p of places.places) {
        let kind: Raw["kind"] | null = null;
        let score = 0;
        if (joined === p.joined) {
          kind = "exact";
          score = 1;
        } else if (otherNumber(joined) === p.joined) {
          kind = "plural";
          score = 1;
        } else if (p.aliases.includes(joined)) {
          kind = "alias";
          score = 1;
        } else if (!edgy && !cells) {
          if (p.key.length > 0 && key === p.key) {
            kind = "sound";
            score = 0.9 + 0.1 * jaroWinkler(joined, p.joined);
          } else if (
            Math.abs(p.joined.length - joined.length) <= 2 &&
            p.joined.slice(0, 2) === joined.slice(0, 2)
          ) {
            const jw = jaroWinkler(joined, p.joined);
            if (jw >= 0.7) {
              kind = "sound";
              score = jw * 0.95;
            }
          }
        }
        if (kind) {
          raw.push({
            start,
            end,
            place: p,
            kind,
            score,
            heard: text.slice(start, end),
            first: i,
            last: i + width - 1,
          });
        }
      }
    }
  }
  const strong = (h: Raw) => h.kind !== "sound" || h.score >= 0.85;
  raw.sort(
    (a, b) =>
      Number(b.kind !== "sound") - Number(a.kind !== "sound") ||
      Number(strong(b)) - Number(strong(a)) ||
      b.end - b.start - (a.end - a.start) ||
      b.score - a.score ||
      a.start - b.start,
  );
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
