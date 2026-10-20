/**
 * The words of a message as the reader sees them: tokens with their
 * offsets, the spans that are literal (never read), and the grammar's own
 * small vocabulary. Every offset is a UTF-16 index into the message, so a
 * token maps straight back onto the editor's text.
 */

export interface Span {
  readonly start: number;
  readonly end: number;
}

export interface Token extends Span {
  /** As written, without trailing punctuation. */
  readonly raw: string;
  /** Lowercased, with a possessive "'s" shed. */
  readonly norm: string;
  /** `norm` with only letters and digits: what a name is matched on. */
  readonly bare: string;
  /** Inside a literal span: quotes, code, a link, a bracket, a $skill or a /command. */
  readonly literal: boolean;
}

const set = (words: readonly string[]): ReadonlySet<string> => new Set(words);

export const DETERMINERS = set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "my",
  "our",
  "your",
  "its",
  "all",
  "every",
  "some",
]);
/** Words that point a name out as the place: "in Atlas", "the Atlas repo". */
export const IN_CUES = set([
  "in",
  "into",
  "inside",
  "within",
  "under",
  "project",
  "folder",
  "repo",
  "called",
  "named",
]);
export const NOUNS = set([
  "cell",
  "cells",
  "agent",
  "agents",
  "session",
  "sessions",
  "project",
  "folder",
  "repo",
  "codebase",
]);
/** Nouns that ask for Cells. "agent" stays readable: people type it. */
export const SPAWN_NOUNS = set(["cell", "cells", "agent", "agents", "session", "sessions"]);
export const PLURAL_NOUNS = set(["cells", "agents", "sessions"]);
/** Words that may come before the address without making it prose. */
export const LEADS = set([
  "hey",
  "ok",
  "okay",
  "so",
  "please",
  "now",
  "and",
  "then",
  "also",
  "lets",
  "let",
  "spawn",
  "start",
  "open",
  "new",
  "create",
  "launch",
  "make",
  "hatch",
  "run",
  "use",
  "a",
  "an",
  "the",
  "another",
  "with",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "effort",
  "ultracode",
  "minimal",
  "extra",
]);
export const MODEL_CUES = set([
  "with",
  "using",
  "use",
  "via",
  "on",
  "by",
  "run",
  "be",
  "meant",
  "mean",
  "try",
]);
/** Words before a count that make it ask for Cells: "spawn 2 Sol", "I want 3 Opus". */
export const LAUNCH = set([
  "spawn",
  "start",
  "open",
  "launch",
  "hatch",
  "want",
  "need",
  "get",
  "run",
  "use",
  "me",
]);
/** Words after a model at the address that keep it a model: "Opus in Atlas", "Opus and Sol". */
export const CONNECT = set(["in", "into", "for", "on", "to", "with", "at", "and"]);
export const EFFORT_QUALIFIERS = set(["effort", "reasoning", "thinking"]);
export const EFFORT_CUES = set(["at", "with", "on", "using", "by"]);
/** Everyday words that are also effort levels: read only with a qualifier or a cue. */
export const AMBIGUOUS_EFFORTS = set(["minimal", "low", "medium", "high", "max"]);
export const UNAMBIGUOUS_EFFORTS = set(["xhigh", "ultracode"]);
/** Words a heard (sound-alike) name may never begin or end with. */
export const CUE_WORDS = set([
  "for",
  "in",
  "into",
  "on",
  "at",
  "to",
  "of",
  "under",
  "inside",
  "within",
  "from",
]);
/** Weak pointers: "release notes for Atlas" may be about Atlas, not in it. */
export const WEAK_CUES = set(["for", "on", "at"]);
/** Words that say nothing about the task: a place alone among them is the whole message. */
export const FILLERS = set([
  "a",
  "an",
  "the",
  "spawn",
  "create",
  "new",
  "start",
  "open",
  "please",
  "one",
  "agent",
  "agents",
  "cell",
  "cells",
  "session",
  "sessions",
  "in",
  "for",
  "on",
  "at",
  "to",
  "and",
  "with",
]);

const COUNTS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  another: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** "two" → 2, "3" → 3; 0 for anything that isn't a count. */
export function countOf(word: string): number {
  const named = COUNTS[word];
  if (named !== undefined) return named;
  return /^\d{1,2}$/.test(word) ? Number(word) : 0;
}

export const isVersion = (word: string) => /^\d+(?:\.\d+)*$/.test(word);
export const timesOf = (word: string): number => {
  const m = /^[x×](\d{1,2})$/.exec(word);
  return m ? Number(m[1]) : 0;
};

/**
 * Spans the reader never reads: code, quotes, markdown links, [brackets],
 * $skills, /commands, paths and @mentions. Writing a word in quotes is how
 * a person makes it "just a word".
 */
export function literalSpans(text: string): Span[] {
  const out: Span[] = [];
  const re =
    /```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”\n]*”|\[[^\]\n]*\]\([^)\n]*\)|\$[\w-]+|(?<=^|\s)[/@~][\w./~-]+/g;
  for (const m of text.matchAll(re)) out.push({ start: m.index, end: m.index + m[0].length });
  for (const b of bracketSpans(text)) out.push(b);
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Balanced [ … ] blocks, brackets included. A "[" opens one only at the
 * start or after whitespace, so `items[0]` stays text; nesting is counted;
 * an unmatched "[" is literal. Ported from the Swift reader.
 */
export function bracketSpans(text: string): Span[] {
  const spans: Span[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "[" && (i === 0 || /\s/.test(text[i - 1]!))) {
      let depth = 0;
      let close = -1;
      for (let j = i; j < text.length; j++) {
        if (text[j] === "[") depth++;
        else if (text[j] === "]") {
          depth--;
          if (depth === 0) {
            close = j;
            break;
          }
        }
      }
      // "[docs](https://…)" is a markdown link, not a bracket.
      if (close >= 0 && text[close + 1] !== "(") {
        spans.push({ start: i, end: close + 1 });
        i = close + 1;
        continue;
      }
    }
    i++;
  }
  return spans;
}

export function tokenize(text: string): Token[] {
  const literals = literalSpans(text);
  const out: Token[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}×][\p{L}\p{N}.'’×-]*/gu)) {
    let word = m[0];
    while (word.length > 0 && /[.'’-]/.test(word[word.length - 1]!)) word = word.slice(0, -1);
    if (word.length === 0) continue;
    const start = m.index;
    const end = start + word.length;
    const norm = word.toLowerCase().replace(/['’]s$/, "");
    out.push({
      start,
      end,
      raw: word,
      norm,
      bare: norm.replace(/[^\p{L}\p{N}]/gu, ""),
      literal: literals.some((r) => start >= r.start && end <= r.end),
    });
  }
  return out;
}

const EDGE = /^[,.;:!?()'"“”‘’\-*•[\]]+|[,.;:!?()'"“”‘’\-*•[\]]+$/g;

/** The words of a stretch of text, lowercased, without edge punctuation. */
export function cleanWords(s: string): string[] {
  return s
    .split(/\s+/)
    .map((w) =>
      w
        .toLowerCase()
        .replace(/['’]s$/, "")
        .replace(EDGE, ""),
    )
    .filter((w) => w.length > 0);
}

export function lineStart(text: string, pos: number): number {
  return text.lastIndexOf("\n", pos - 1) + 1;
}

/** A sentence ends at . ! ? or ; followed by space (never the dot in "5.5"), or a line. */
export function sentenceStart(text: string, pos: number): number {
  const from = lineStart(text, pos);
  let at = from;
  const re = /[.!?;](?=\s)/g;
  re.lastIndex = from;
  const head = text.slice(0, pos);
  for (let m = re.exec(head); m !== null; m = re.exec(head)) at = m.index + 1;
  return at;
}

export const SENTENCE_BREAK = /[.!?;](?=\s)|\n/;

export function sameSentence(text: string, a: number, b: number): boolean {
  return !SENTENCE_BREAK.test(text.slice(Math.min(a, b), Math.max(a, b)));
}

/** True when punctuation that ends a phrase sits between tokens a and b. */
export function crosses(text: string, tokens: readonly Token[], a: number, b: number): boolean {
  for (let k = a; k < b; k++) {
    if (/[.!?;:\n]/.test(text.slice(tokens[k]!.end, tokens[k + 1]!.start))) return true;
  }
  return false;
}

export interface Next {
  /** Nothing follows. */
  readonly end: boolean;
  /** Punctuation follows first; `ch` says which. */
  readonly punct: boolean;
  readonly ch: string | null;
  /** The next word, cleaned, when a word follows first. */
  readonly word: string | null;
}

/** What follows a position: the end, punctuation, or a word. */
export function after(text: string, pos: number): Next {
  const rest = text.slice(pos);
  const i = /^[ \t]*/.exec(rest)![0].length;
  if (i >= rest.length) return { end: true, punct: true, ch: null, word: null };
  if (/[,.;:!?()\n]/.test(rest[i]!)) return { end: false, punct: true, ch: rest[i]!, word: null };
  const w = /^[^\s,.;:!?()]+/.exec(rest.slice(i));
  return {
    end: false,
    punct: false,
    ch: null,
    word: w
      ? w[0]
          .toLowerCase()
          .replace(/['’]s$/, "")
          .replace(EDGE, "")
      : null,
  };
}
