/**
 * Models and efforts named in a message. Writing a model's name doesn't
 * pick it: "write a haiku" and "the flash message" stay text. A model acts
 * only where the sentence anchors it (a cue, a Cell noun, a count after a
 * launch word, the address); an everyday effort word ("high", "max") only
 * with a qualifier, a cue in a message that routes, or right after a model.
 * Ported from the Swift app's `ModelRouter.facts`.
 */

import type { ModelForm, ModelLexicon } from "./catalog";
import {
  AMBIGUOUS_EFFORTS,
  CONNECT,
  EFFORT_CUES,
  EFFORT_QUALIFIERS,
  LAUNCH,
  MODEL_CUES,
  PLURAL_NOUNS,
  SPAWN_NOUNS,
  type Span,
  type Token,
  UNAMBIGUOUS_EFFORTS,
  after,
  cleanWords,
  countOf,
  crosses,
  goesOn,
  lineStart,
  sentenceStart,
  timesOf,
} from "./text";

export type ModelAnchor = "cue" | "noun" | "count" | "address" | "joined";

export interface ModelHit extends Span {
  readonly form: ModelForm;
  readonly first: number;
  readonly last: number;
  readonly anchor: ModelAnchor;
  /** How many Cells this model asks for. */
  readonly count: number;
  /** The count's own word, when one was typed: "2" in "2 Sol", "×3" in "Sol ×3". */
  readonly countToken: Token | null;
}

/** Every catalog form in the words, the longest at each place, outside literals. */
function modelMatches(text: string, tokens: readonly Token[], lexicon: ModelLexicon) {
  const out: { start: number; end: number; first: number; last: number; form: ModelForm }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.literal) continue;
    let best: ModelForm | null = null;
    for (const f of lexicon.forms) {
      const n = f.words.length;
      if (i + n > tokens.length || (best && n <= best.words.length)) continue;
      let ok = true;
      for (let k = 0; k < n && ok; k++)
        ok = !tokens[i + k]!.literal && tokens[i + k]!.norm === f.words[k];
      if (ok && n > 1 && crosses(text, tokens, i, i + n - 1)) ok = false;
      if (ok) best = f;
    }
    if (best) {
      const last = i + best.words.length - 1;
      out.push({ start: tokens[i]!.start, end: tokens[last]!.end, first: i, last, form: best });
      i = last;
    }
  }
  return out;
}

/**
 * The models the sentence anchors, with their counts. `isLead` says which
 * words may open the address; `placeWords` are the roster's single-word
 * names, so "Opus Atlas" keeps Opus at the address.
 */
export function modelHits(
  text: string,
  tokens: readonly Token[],
  lexicon: ModelLexicon,
  isLead: (word: string) => boolean,
  placeWords: ReadonlySet<string>,
): ModelHit[] {
  const kept: ModelHit[] = [];
  const unbroken = (a: number, b: number) => !/[.!?;:\n]/.test(text.slice(a, b));
  const sameLine = (pos: number) =>
    kept.some((k) => lineStart(text, k.start) === lineStart(text, pos));
  for (const m of modelMatches(text, tokens, lexicon)) {
    const prev = m.first > 0 ? tokens[m.first - 1]! : null;
    const next = after(text, m.end);
    const before = cleanWords(text.slice(sentenceStart(text, m.start), m.start));
    let anchor: ModelAnchor | null = null;
    let countToken: Token | null = null;
    // Behind a cue, the model has to end the phrase: "with Opus at max", not
    // "with haiku structure".
    if (
      prev &&
      !prev.literal &&
      MODEL_CUES.has(prev.norm) &&
      unbroken(prev.end, m.start) &&
      goesOn(next, placeWords)
    )
      anchor = "cue";
    if (!anchor && next.word && SPAWN_NOUNS.has(next.word)) anchor = "noun";
    if (prev && !prev.literal && countOf(prev.norm) > 0 && unbroken(prev.end, m.start)) {
      const lead = cleanWords(text.slice(sentenceStart(text, prev.start), prev.start));
      const w0 = lead[lead.length - 1];
      const joined =
        (w0 === "and" ||
          w0 === "plus" ||
          /,\s*$/.test(text.slice(lineStart(text, prev.start), prev.start))) &&
        sameLine(m.start);
      if (!anchor && (lead.every(isLead) || (w0 !== undefined && LAUNCH.has(w0)))) anchor = "count";
      if (!anchor && joined) anchor = "joined";
      if (anchor) countToken = prev;
    }
    if (!anchor && before.every(isLead)) {
      const continues =
        next.end ||
        next.ch === ":" ||
        next.ch === "," ||
        (next.word !== null &&
          (CONNECT.has(next.word) ||
            AMBIGUOUS_EFFORTS.has(next.word) ||
            UNAMBIGUOUS_EFFORTS.has(next.word) ||
            timesOf(next.word) > 0 ||
            placeWords.has(next.word)));
      if (continues) anchor = "address";
    }
    if (!anchor && prev && ["and", "or", "plus"].includes(prev.norm) && sameLine(m.start))
      anchor = "joined";
    if (!anchor) continue;
    let count = countToken ? countOf(countToken.norm) : 0;
    const times = next.word ? timesOf(next.word) : 0;
    if (times > 0) {
      count = times;
      countToken = tokens[m.last + 1] ?? null;
    }
    if (count === 0)
      count = m.form.plural || (next.word !== null && PLURAL_NOUNS.has(next.word)) ? 2 : 1;
    kept.push({
      start: m.start,
      end: m.end,
      first: m.first,
      last: m.last,
      form: m.form,
      anchor,
      count,
      countToken,
    });
  }
  return kept;
}

export interface EffortHit extends Span {
  /** The level as the words say it, before any clamping: "xhigh", "max". */
  readonly level: string;
  /** "at" in "at max": a grammar word the task loses with the effort. */
  readonly cue: Token | null;
}

export function effortHits(
  text: string,
  tokens: readonly Token[],
  models: readonly ModelHit[],
  routed: boolean,
): EffortHit[] {
  const out: EffortHit[] = [];
  const modelEnds = new Set(models.map((m) => m.last));
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.literal) continue;
    let level: string | null = null;
    let j = i;
    if ((t.norm === "extra" || t.norm === "x") && tokens[i + 1]?.norm === "high") {
      level = "xhigh";
      j = i + 1;
    } else if (t.norm === "x-high" || t.norm === "xhigh") level = "xhigh";
    else if (UNAMBIGUOUS_EFFORTS.has(t.norm) || AMBIGUOUS_EFFORTS.has(t.norm)) level = t.norm;
    if (!level) continue;
    const next = after(text, tokens[j]!.end);
    const qualified =
      next.word !== null && EFFORT_QUALIFIERS.has(next.word) && tokens[j + 1] !== undefined;
    const prev = i > 0 ? tokens[i - 1]! : null;
    const afterModel =
      prev !== null && modelEnds.has(i - 1) && !/[.!?;:\n]/.test(text.slice(prev.end, t.start));
    const cue = prev !== null && EFFORT_CUES.has(prev.norm) ? prev : null;
    const ok =
      UNAMBIGUOUS_EFFORTS.has(level) ||
      level === "xhigh" ||
      qualified ||
      afterModel ||
      (cue !== null &&
        routed &&
        (next.end || next.punct || (next.word !== null && CONNECT.has(next.word))));
    if (!ok) continue;
    const end = qualified ? tokens[j + 1]!.end : tokens[j]!.end;
    out.push({ start: t.start, end, level, cue });
    i = qualified ? j + 1 : j;
  }
  return out;
}
