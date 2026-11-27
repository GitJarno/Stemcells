// A message cut into numbered pieces (stemcells/tasks/aski-orchestrator.md, decision 3). The
// compiler names pieces by number and never writes a Cell's words, so the pieces are small and
// every character of the message that isn't blank belongs to exactly one. Dictation has no
// punctuation, so a piece also ends where speech opens a new item ("the second", "another").

export interface Piece {
  /** From 1, as the model reads it. */
  readonly n: number;
  readonly text: string;
  /** UTF-16 offsets into the message. */
  readonly start: number;
  readonly end: number;
}

/** A piece longer than this many words is cut again at its commas and joining words. */
const LONG = 28;
/** A cut never leaves a piece shorter than this many words. */
const SHORT = 3;

const ORDINAL = "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|next|last|other";
/**
 * Where speech opens a new item, mid-sentence: "…the gallery the second for Harbor's page",
 * "…and one Sol agent for the copy", "also a new project called…". Each needs whitespace before.
 */
const OPENERS = new RegExp(
  String.raw`\s(?=(?:and\s+|then\s+|and\s+then\s+|plus\s+|also\s+)?(?:` +
    String.raw`(?:the\s+)?(?:${ORDINAL})\s+(?:one|agent|cell|is|will|should|for|to|in|on)\b` +
    String.raw`|another\s+(?:one|agent|cell|for|to|in|on)\b` +
    String.raw`|one\s+(?:for|to|more|new|agent|cell)\b` +
    String.raw`|one\s+\S+\s+(?:agent|cell)\b` +
    String.raw`|(?:a|one|another)\s+new\s+project\b` +
    String.raw`|new\s+project\b` +
    String.raw`))`,
  "giu",
);
/** "one in Harbor …, one in Atlas …" opens an item; "the one in Atlas" is a thing. */
const ONE_IN = /(?<!\bthe)\s(?=(?:and\s+|then\s+|also\s+)?one\s+(?:in|on)\s)/giu;
/** A joining word that may start a new piece when its piece ran long. */
const JOINS = /\s(?=(?:and|then|also|plus|but)\s)/giu;

const wordsIn = (text: string) => (text.match(/\S+/gu) ?? []).length;

/** Sentence and line ends: ".", "!", "?" before whitespace, ";", a newline. Never inside "v2.1". */
function hardCuts(text: string): number[] {
  const cuts: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "\n" || c === ";") cuts.push(i + 1);
    else if (".!?".includes(c) && (i + 1 === text.length || /\s/u.test(text[i + 1]!))) {
      // "2." opening a list line is the item's number, not a sentence.
      const line = text.slice(text.lastIndexOf("\n", i - 1) + 1, i);
      if (!/^\s*\d{1,3}$/u.test(line)) cuts.push(i + 1);
    }
  }
  return cuts;
}

function trimmed(text: string, start: number, end: number): { start: number; end: number } | null {
  let a = start;
  let b = end;
  while (a < b && /\s/u.test(text[a]!)) a++;
  while (b > a && /\s/u.test(text[b - 1]!)) b--;
  return a < b ? { start: a, end: b } : null;
}

/** `span` cut at each of `at` that leaves `SHORT` words on both sides. */
function cutAt(
  text: string,
  span: { start: number; end: number },
  at: readonly number[],
): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  let from = span.start;
  for (const cut of at) {
    if (cut <= from || cut >= span.end) continue;
    if (wordsIn(text.slice(from, cut)) < SHORT || wordsIn(text.slice(cut, span.end)) < SHORT)
      continue;
    const piece = trimmed(text, from, cut);
    if (piece) out.push(piece);
    from = cut;
  }
  const rest = trimmed(text, from, span.end);
  if (rest) out.push(rest);
  return out;
}

const matchesIn = (text: string, span: { start: number; end: number }, regex: RegExp) =>
  [...text.slice(span.start, span.end).matchAll(regex)].map((m) => span.start + m.index);

/**
 * Where speech moves to another project: "… then in Ledger one for the tax report". The place
 * goes with what follows it, so the cut stands before the joining word, not after the name.
 */
function placeOpeners(names: readonly string[]): RegExp | null {
  const said = names
    .map((name) =>
      name
        .replace(/([a-z])([A-Z])/gu, "$1 $2")
        .split(/[^\p{L}\p{N}.]+/u)
        .filter((word) => word.length > 0)
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
        .join("[\\s_-]*"),
    )
    .filter((pattern) => pattern.length > 0);
  if (said.length === 0) return null;
  return new RegExp(
    String.raw`\s(?=(?:and\s+then|then|and|also|plus)\s+(?:in|on|for|inside|into)\s+(?:the\s+)?(?:${said.join("|")})(?![\p{L}\p{N}]))`,
    "giu",
  );
}

/**
 * The message as pieces, in order. An empty message has none. `places` are the person's
 * projects' names: a piece also ends where the words move on to another of them.
 */
export function piecesOf(text: string, places: readonly string[] = []): Piece[] {
  let spans: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (const cut of [...hardCuts(text), text.length]) {
    const span = trimmed(text, from, cut);
    if (span) spans.push(span);
    from = cut;
  }
  const moves = placeOpeners(places);
  spans = spans.flatMap((span) =>
    cutAt(
      text,
      span,
      [
        ...matchesIn(text, span, OPENERS),
        ...matchesIn(text, span, ONE_IN),
        ...(moves ? matchesIn(text, span, moves) : []),
      ].sort(
        (a, b) => a - b,
      ),
    ),
  );
  spans = spans.flatMap((span) =>
    wordsIn(text.slice(span.start, span.end)) <= LONG
      ? [span]
      : cutAt(text, span, [
          ...matchesIn(text, span, /,\s/gu).map((at) => at + 1),
          ...matchesIn(text, span, JOINS),
        ].sort((a, b) => a - b)),
  );
  return spans.map((span, i) => ({ n: i + 1, text: text.slice(span.start, span.end), ...span }));
}
