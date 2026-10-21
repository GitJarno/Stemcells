/**
 * The answers in a message to Aski: which cards it answers, and how
 * (stemcells/tasks/aski-room.md, decision 8 and "The dictation grammar").
 * It reads as the person types, the same way every time, and the cards
 * light up from what it finds. Words can say no; only a click says yes: an
 * option that allows anything reads as "needs your click", never as an
 * answer to send. A Cell never sees our numbers.
 */
import { literalSpans, type Span, tokenize } from "../../words/text";
import { type Card, type CardOption, type Choice, LATER } from "../card";
import type { NeedKind } from "../wire";

/** A card the words may answer. */
export interface Addressee {
  readonly number: number;
  /** Who the card is for, as it shows it. */
  readonly who: string;
  /** The Cell's name, which "Floof, …" answers by; null for a subagent's card. */
  readonly name: string | null;
  readonly kind: NeedKind;
  /** What a prose card's pre-read found. */
  readonly cue: "question" | "offer" | "stopped" | null;
  readonly card: Card;
  /** It left the list while the person typed: nothing goes to it. */
  readonly gone: boolean;
  /** An answer to it waits out its undo window, or has gone. */
  readonly held: boolean;
}

/** Why a part's words stay in the composer instead of going anywhere. */
export type Kept =
  /** They name one of our option numbers, which a Cell can't read. */
  | "numbers"
  /** Words this card doesn't take. */
  | "unread"
  /** A card named, and nothing said. */
  | "empty"
  /** An option number past the card's options. */
  | "no-option"
  /** The card left the list. */
  | "gone"
  /** A permission named in a list: those are answered one at a time. */
  | "list"
  /** The card was answered earlier in the message. */
  | "twice"
  /** The card holds several questions: they're answered on the card. */
  | "questions"
  /** Two cards' Cells have the name. */
  | "names";

export type Reading =
  /** One of the card's options, with the person's words when it takes them. */
  | { readonly kind: "option"; readonly option: CardOption; readonly words: string | null }
  /** An answer to the card's one question: one of its options, or the person's own words. */
  | {
      readonly kind: "answer";
      readonly answers: Readonly<Record<string, string | ReadonlyArray<string>>>;
      readonly label: string;
      /** The option it picks; null for the person's own words. */
      readonly pick: string | null;
    }
  /** Opens the Cell's chat. */
  | { readonly kind: "open" }
  /** An option only a click may choose: it lights on the card. */
  | { readonly kind: "click"; readonly option: CardOption }
  /** An option that sends the person's words, with none given. */
  | { readonly kind: "words"; readonly option: CardOption }
  | { readonly kind: "kept"; readonly why: Kept; readonly option?: number };

export interface Target {
  readonly number: number;
  readonly reading: Reading;
  /** Where the words that answer this card end: a list's cards may stop at different words. */
  readonly end: number;
}

export interface AnswerPart extends Span {
  /** The words that name the card. */
  readonly anchor: Span;
  /** The words of the fixed form that answered it ("go with 2", "reply"); null for free words. */
  readonly form: Span | null;
  /** One per card named; a list names several. Empty when no card has the number. */
  readonly targets: ReadonlyArray<Target>;
  /** "for 5" with no card 5. */
  readonly missing: number | null;
}

export interface Answers {
  readonly parts: ReadonlyArray<AnswerPart>;
  /** Each part's stretch of the text: what the composer's own reader reads as blank. */
  readonly spans: ReadonlyArray<Span>;
  /** The stretches of text the parts leave, each trimmed: what goes to Aski. */
  readonly rest: ReadonlyArray<Span>;
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
const ORDINALS: Readonly<Record<string, number>> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
  "5th": 5,
  "6th": 6,
  "7th": 7,
  "8th": 8,
  "9th": 9,
};

const set = (words: string) => new Set(words.split(" "));

/** Nouns that name a card by its number: "decision 2". */
const CARD_NOUNS = set("number item decision card question no");
/** Words that may stand between parts without being said to anyone. */
const JOINERS = set("and then also so ok okay now next plus oh");
/** Words before an answer that don't change it: "let's go with 2", "I think we should wait". */
const FILLERS = set(
  "let lets us we i i'd i'll we'll we'd think should would could can please just um uh er hmm well so then maybe probably guess actually",
);
/** Words that say an answer follows a bare number: "3 yes", "1 go with 2". */
const ANSWER_WORDS = set(
  "yes yeah yep yup sure ok okay no nope nah allow approve accept deny decline reject refuse go pick option take choose reply say tell answer respond retry try rerun wait hold later snooze nothing skip dismiss settle ignore open carry continue proceed build implement refine revise change nudge steer stop interrupt let lets don't dont not never do always just",
);
/** Words a title's match skips: they say nothing about which option. */
const STOP = set(
  "the a an it its to of and then with in on for this that please just do so let us me my your",
);
/** Small words after a closed answer that it takes with it: "approve it", "go ahead please". */
const TAILS = set("it that this please thanks thank you once one option");
const NEGATIONS = set("don't dont not never");
/** What a number counts when it isn't a card: "for 5 minutes", "for 2 more tests". */
const UNITS = set(
  "minute minutes min mins hour hours h second seconds sec secs s day days week weeks times more of percent",
);

const YES = set("yes yeah yep yup sure ok okay allow approve approved accept fine alright");
const NO = set("no nope nah deny decline declined reject refuse");

type Kinds = ReadonlyArray<Choice["kind"] | "later" | "open">;

/** Fixed verbs, longest first within each, and the options they choose, the first the card has. */
const VERBS: ReadonlyArray<{ readonly words: ReadonlyArray<string>; readonly kinds: Kinds }> = [
  ...phrases("go ahead|do it|proceed|keep going|carry on|go on|continue", [
    "goAhead",
    "carryOn",
    "continueNow",
    "build",
  ]),
  ...phrases("build it|build|implement it|implement", ["build"]),
  ...phrases("try again|run it again|retry|rerun", ["retry"]),
  ...phrases("hold on|wait", ["wait", "carryOn", "later"]),
  ...phrases("not now|later|snooze", ["later", "wait"]),
  ...phrases("nothing to do|never mind|nevermind|ignore it|leave it|skip it|nothing|skip|settle", [
    "nothingToDo",
    "dismiss",
    "dismissQuestion",
  ]),
  ...phrases("dismiss it|dismiss", ["dismiss", "dismissQuestion", "nothingToDo"]),
  ...phrases("open the chat|open its chat|open chat|open it|open", ["open"]),
  ...phrases("stop and reply|stop then reply|interrupt|stop", ["stopAndReply"]),
  ...phrases("nudge|steer", ["nudge"]),
  ...phrases("refine|revise|change", ["revise"]),
];
/** Words that hand what follows to the Cell: "reply use staging", "tell it to wait". */
const REPLY_VERBS = ["tell it", "tell them", "reply", "say", "answer", "respond"].map((p) =>
  p.split(" "),
);
/** The options a reply goes through, the first the card has. */
const REPLIES: ReadonlyArray<Choice["kind"]> = [
  "reply",
  "stopAndReply",
  "revise",
  "declineWithNote",
];
/** Words that pick an option by its number: "go with 2", "option two", "take the second". */
const PICKS = [
  "go with",
  "go for",
  "going with",
  "how about",
  "pick",
  "option",
  "take",
  "choose",
].map((p) => p.split(" "));
/** Free words that name one of our option numbers: a Cell can't read them. */
const NAMES_A_NUMBER =
  /\b(?:go(?:ing)? (?:with|for)|pick|option|take|choose|number)\s+(?:the\s+)?(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b|\bthe (?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth) (?:one|option)\b/i;

const SENTENCE_END = /[.!?;](?=\s|$)|\n/g;
const SENTENCE_BREAK = /[.!?;](?=\s|$)|\n/;
const BOUNDARY = /[,.;:!?\n—–]|\s-\s/;
const LIST_ITEM = /^\s*\d{1,2}[.)]\s+\S/gm;

function phrases(list: string, kinds: Kinds) {
  return list.split("|").map((phrase) => ({ words: phrase.split(" "), kinds }));
}

function numberOf(word: string): number {
  if (/^\d{1,2}$/.test(word)) return Number(word);
  return NUMBER_WORDS[word] ?? 0;
}

/** Text at its edges without spaces or joining punctuation, and after a part, without joining words. */
function trimmed(text: string, span: Span, afterPart = true): Span {
  let { start, end } = span;
  const lead = afterPart ? /^(?:[\s,.;:!?—–-]+|(?:and|then|also|so|plus)\b)/i : /^\s+/;
  for (;;) {
    const head = lead.exec(text.slice(start, end));
    if (!head || head[0].length === 0) break;
    start += head[0].length;
  }
  for (;;) {
    const tail = /(?:[\s,;:—–-]+|\b(?:and|then|also|so|plus))$/i.exec(text.slice(start, end));
    if (!tail || tail[0].length === 0) break;
    end -= tail[0].length;
  }
  return { start, end: Math.max(start, end) };
}

/**
 * Reads the answers in `text` to the cards in `cards`. `sent` writes a
 * stretch of the text as a Cell is sent it; by default, as it stands.
 */
export function readAnswers(
  text: string,
  cards: ReadonlyArray<Addressee>,
  sent: (span: Span) => string = (span) => text.slice(span.start, span.end),
): Answers {
  // With no card open, every word is Aski's.
  if (cards.length === 0) {
    const all = trimmed(text, { start: 0, end: text.length }, false);
    return { parts: [], spans: [], rest: /[\p{L}\p{N}]/u.test(text) ? [all] : [] };
  }
  const tokens = tokenize(text);
  const listLines = [...text.matchAll(LIST_ITEM)].length >= 2;
  // A number is given again only once the list empties, so a card still
  // leaving may share one with a new card: the live card has it.
  const cardAt = (n: number) =>
    cards.find((card) => card.number === n && !card.gone) ??
    cards.find((card) => card.number === n) ??
    null;
  const word = (k: number): string | null => {
    const token = tokens[k];
    return token === undefined || token.literal ? null : token.norm;
  };
  const gapBefore = (k: number) =>
    text.slice(k === 0 ? 0 : tokens[k - 1]!.end, tokens[k]?.start ?? text.length);
  const gapAfter = (k: number) =>
    text.slice(tokens[k]!.end, k + 1 < tokens.length ? tokens[k + 1]!.start : text.length);
  /** The first token at or after an offset. */
  const tokenFrom = (offset: number) => {
    const k = tokens.findIndex((token) => token.start >= offset);
    return k === -1 ? tokens.length : k;
  };
  const literals = literalSpans(text);
  /** Where the sentence that holds `offset` ends; a quote's own sentences don't end it. */
  const sentenceEnd = (offset: number) => {
    SENTENCE_END.lastIndex = offset;
    for (let end = SENTENCE_END.exec(text); end !== null; end = SENTENCE_END.exec(text)) {
      if (!literals.some((span) => end!.index >= span.start && end!.index < span.end))
        return end.index + end[0].length;
    }
    return text.length;
  };
  /** Whether tokens k… read `words`, inside `limit`. */
  const reads = (k: number, words: ReadonlyArray<string>, limit: number) =>
    words.every((w, n) => word(k + n) === w && tokens[k + n]!.end <= limit);

  /**
   * Whether token i may start a part: at the start, after punctuation, right
   * after the last part, or after joining words that stand there.
   */
  const opens = (i: number, taken: number) => {
    for (let j = i; ; j--) {
      if (j === 0) return true;
      if (BOUNDARY.test(gapBefore(j)) || tokens[j - 1]!.end <= taken) return true;
      if (!JOINERS.has(word(j - 1) ?? "")) return false;
    }
  };

  /** What follows token k says an answer comes: punctuation, or an answer word. */
  const answerFollows = (k: number) => {
    if (/^\s*[:,.]/.test(gapAfter(k))) return true;
    const next = word(k + 1);
    if (next === null || SENTENCE_BREAK.test(gapAfter(k))) return false;
    if (next === "the") return ORDINALS[word(k + 2) ?? ""] !== undefined;
    return ANSWER_WORDS.has(next);
  };

  /** A line-start "1." in a pasted list is the list's, not an answer. */
  const listItem = (k: number) =>
    listLines &&
    /^\s*[.)]/.test(gapAfter(k)) &&
    text.slice(text.lastIndexOf("\n", tokens[k]!.start - 1) + 1, tokens[k]!.start).trim() === "";

  interface Anchor extends Span {
    /** The token after the anchor's words. */
    readonly next: number;
    readonly numbers: ReadonlyArray<number>;
    /** "Floof, …": it holds only when the rest is an answer. */
    readonly byName: boolean;
    readonly missing: number | null;
  }

  /** The anchor's span, with the punctuation right after it. */
  const anchorOf = (
    start: number,
    last: number,
    rest: Omit<Anchor, "start" | "end" | "next">,
  ): Anchor => {
    const punct = /^\s*[:,.]/.exec(gapAfter(last));
    return {
      start,
      end: tokens[last]!.end + (punct ? punct[0].length : 0),
      next: last + 1,
      ...rest,
    };
  };

  const byNumber = (start: number, k: number, n: number): Anchor | null => {
    if (n === 0 || UNITS.has(word(k + 1) ?? "")) return null;
    const card = cardAt(n);
    if (card === null && !answerFollows(k)) return null;
    return anchorOf(start, k, {
      numbers: card === null ? [] : [n],
      byName: false,
      missing: card === null ? n : null,
    });
  };

  /** "decision 2", "#2", "2": the number token, after an optional noun. */
  const explicitAt = (k: number): number | null => {
    if (CARD_NOUNS.has(word(k) ?? "") && numberOf(word(k + 1) ?? "") > 0) return k + 1;
    if (/#\s*$/.test(gapBefore(k)) && numberOf(word(k) ?? "") > 0) return k;
    return null;
  };

  const named = (k: number): Addressee[] => {
    const w = word(k);
    return w === null ? [] : cards.filter((card) => card.name?.toLowerCase() === w);
  };

  const nameAnchor = (start: number, k: number, after: number): Anchor | null => {
    const found = named(k);
    if (found.length === 0) return null;
    return anchorOf(start, after, {
      numbers: found.map((card) => card.number),
      byName: true,
      missing: null,
    });
  };

  const anchorAt = (i: number): Anchor | null => {
    const t = tokens[i]!;
    const w = word(i);
    if (w === null) return null;
    const start = /#\s*$/.test(gapBefore(i)) ? text.lastIndexOf("#", t.start) : t.start;

    if (w === "for") {
      const k = explicitAt(i + 1) ?? (numberOf(word(i + 1) ?? "") > 0 ? i + 1 : null);
      if (k !== null) return byNumber(start, k, numberOf(word(k)!));
      const ordinal = word(i + 1) === "the" ? ORDINALS[word(i + 2) ?? ""] : undefined;
      if (ordinal !== undefined) return byNumber(start, i + 2, ordinal);
      if (named(i + 1).length > 0) return nameAnchor(start, i + 1, i + 1);
      return null;
    }
    // Dictation hears "for 2" as "four 2" or "4 2".
    if ((w === "four" || w === "4") && /^[ \t]+$/.test(gapAfter(i))) {
      const n = numberOf(word(i + 1) ?? "");
      if (n > 0 && cardAt(n) !== null && !(w === "4" && cardAt(4) !== null && answerFollows(i)))
        return byNumber(start, i + 1, n);
    }
    const explicit = explicitAt(i);
    if (explicit !== null) return byNumber(start, explicit, numberOf(word(explicit)!));
    if (w === "the" && ORDINALS[word(i + 1) ?? ""] !== undefined) {
      const last = word(i + 2) === "one" ? i + 2 : i + 1;
      return answerFollows(last) && cardAt(ORDINALS[word(i + 1)!]!) !== null
        ? byNumber(start, last, ORDINALS[word(i + 1)!]!)
        : null;
    }
    if (w === "tell" && named(i + 1).length > 0)
      return nameAnchor(start, i + 1, word(i + 2) === "to" ? i + 2 : i + 1);
    if (named(i).length > 0 && /^\s*[:,]/.test(gapAfter(i))) return nameAnchor(start, i, i);

    // A bare number names a card only when an answer follows it; else it
    // may be a count ("2 Sol in Harbor …"), which the composer reads.
    if (!/^\d{1,2}$/.test(w) || listItem(i)) return null;
    const listed = [i];
    for (let k = i; ;) {
      const gap = gapAfter(k);
      const joined =
        /^\s*(?:,|&)\s*$/.test(gap) || (/^\s+$/.test(gap) && word(k + 1) === "and")
          ? word(k + 1) === "and"
            ? k + 2
            : k + 1
          : null;
      if (joined === null || !/^\d{1,2}$/.test(word(joined) ?? "")) break;
      listed.push(joined);
      k = joined;
    }
    const last = listed[listed.length - 1]!;
    if (listed.length > 1 && answerFollows(last)) {
      const numbers = listed.map((k) => Number(word(k)));
      if (numbers.every((n) => cardAt(n) !== null))
        return anchorOf(start, last, { numbers, byName: false, missing: null });
    }
    const n = Number(w);
    return cardAt(n) !== null && answerFollows(i) ? byNumber(start, i, n) : null;
  };

  interface Said {
    readonly text: string;
    readonly end: number;
  }
  interface Read {
    readonly reading: Reading;
    /** Where the answer's words end. */
    readonly end: number;
    /** Read from free words: no fixed form matched. */
    readonly free: boolean;
    /** The words of the fixed form that answered: "go with 2", "reply". */
    readonly form: Span | null;
  }

  /** The words from an offset to the part's limit, trimmed, without quotes around them. */
  const wordsIn = (from: number, limit: number): { text: string; end: number } => {
    const span = trimmed(text, { start: from, end: limit });
    const quoted = /^["“][^"”]*["”]$/.test(text.slice(span.start, span.end));
    const said = quoted ? { start: span.start + 1, end: span.end - 1 } : span;
    return { text: sent(said).trim(), end: span.end };
  };

  /** Words in quotes from an offset: what's inside them, and where they close. */
  const quotedAt = (open: number, limit: number): { text: string; end: number } | null => {
    if (!/["“]/.test(text[open] ?? "")) return null;
    const close = text.slice(open + 1, limit).search(/["”]/);
    if (close === -1) return null;
    return { text: sent({ start: open + 1, end: open + 1 + close }).trim(), end: open + close + 2 };
  };

  const readAnswer = (card: Addressee, from: number, limit: number): Read => {
    const last = (k: number) => tokens[k - 1]?.end ?? 0;
    const inside = (j: number) => j < tokens.length && tokens[j]!.start < limit;
    let k = from;
    while (inside(k) && FILLERS.has(word(k) ?? "")) k++;
    if (!inside(k))
      return { reading: { kind: "kept", why: "empty" }, end: limit, free: false, form: null };

    const options = card.card.options;
    const questions = card.card.questions;
    const question = questions.length === 1 ? questions[0]! : null;
    const has = (kind: Kinds[number]): CardOption | null =>
      kind === "later"
        ? card.card.later
          ? LATER
          : null
        : (options.find((option) => option.choice.kind === kind) ?? null);
    /** The card takes free words as its reply. */
    const takesWords = has("reply") !== null || has("stopAndReply") !== null;
    const kept = (why: Kept, end: number, option?: number): Read => ({
      reading: option === undefined ? { kind: "kept", why } : { kind: "kept", why, option },
      end,
      free: false,
      form: null,
    });
    /** The words from the answer's start to the end of token j - 1. */
    const formTo = (j: number): Span | null =>
      j > k ? { start: tokens[k]!.start, end: last(j) } : null;

    /**
     * An answer of a fixed form that ends before token j, through the small
     * words it takes with it. On a card that takes free words, it holds only
     * where the words stop or join on: "go ahead but skip the docs" is a reply.
     */
    const closed = (j: number, reading: Reading): Read | "free" => {
      while (inside(j) && TAILS.has(word(j) ?? "")) j++;
      const stops = !inside(j) || /[,.;:!?—–]/.test(gapBefore(j)) || JOINERS.has(word(j) ?? "");
      if (takesWords && !stops) return "free";
      return { reading, end: last(j), free: false, form: formTo(j) };
    };
    /** An option, as words may choose it: never one that allows. */
    const chose = (option: CardOption, j: number, said: Said | null): Read | "free" => {
      if (option.allows) return closed(j, { kind: "click", option });
      if (option.words === null) return closed(j, { kind: "option", option, words: null });
      if (said === null || said.text === "") return closed(j, { kind: "words", option });
      if (NAMES_A_NUMBER.test(said.text)) return kept("numbers", said.end);
      return {
        reading: { kind: "option", option, words: said.text },
        end: said.end,
        free: false,
        form: formTo(j),
      };
    };
    /** The words after token j, to the limit. */
    const after = (j: number): Said | null => (inside(j) ? wordsIn(last(j), limit) : null);
    const choseWith = (option: CardOption, j: number) =>
      chose(option, j, option.words === null ? null : after(j));
    const answer = (j: number, index: number): Read | "free" => {
      const choice = question!.options[index]!;
      return closed(j, {
        kind: "answer",
        answers: { [question!.id]: question!.multiSelect ? [choice.answer] : choice.answer },
        label: choice.label,
        pick: choice.answer,
      });
    };

    /** Steps 1 to 4: an answer of a fixed form, at the part's start. */
    const fixed = (): Read | "free" | null => {
      if (NEGATIONS.has(word(k) ?? "") || (word(k) === "do" && word(k + 1) === "not"))
        return reads(k, ["not", "now"], limit) ? verb() : null;

      // 1. An option by its number: "go with 2", "option two", "the second
      // one", a bare "2". The card's own questions number their options.
      const pick = PICKS.find((p) => reads(k, p, limit));
      let j = k + (pick?.length ?? 0);
      const the = word(j) === "the";
      if (the) j++;
      if (pick && (word(j) === "option" || word(j) === "number")) j++;
      const said = inside(j) ? (word(j) ?? "") : "";
      const ordinal = ORDINALS[said];
      const ends = !inside(j + 1) || /^\s*[,.;!?\n]/.test(gapAfter(j));
      const n = pick
        ? (ordinal ?? numberOf(said))
        : ordinal !== undefined && (ends || TAILS.has(word(j + 1) ?? ""))
          ? ordinal
          : !the && ends
            ? numberOf(said)
            : 0;
      if (n > 0) {
        if (questions.length > 1) return kept("questions", last(j + 1));
        const count = question ? question.options.length : options.length;
        if (n > count) return kept("no-option", last(j + 1), n);
        return question ? answer(j + 1, n - 1) : choseWith(options[n - 1]!, j + 1);
      }

      // 2. An option by its title: every word said is in exactly one
      // option's title, or the words run along the start of one.
      const titled = [
        ...(question?.options.map((choice, index) => ({ title: choice.label, index })) ?? []),
        ...options.map((option) => ({ title: option.title, option })),
        ...(card.card.later ? [{ title: LATER.title, option: LATER }] : []),
      ].map((each) => ({ ...each, words: tokenize(each.title).map((t) => t.norm) }));
      const content: string[] = [];
      for (let m = k; inside(m); m++) {
        const w = word(m);
        if (w !== null && !STOP.has(w)) content.push(w);
      }
      const within =
        content.length === 0
          ? []
          : titled.filter((each) => content.every((w) => each.words.includes(w)));
      const runs = titled
        .map((each) => {
          let n = 0;
          while (n < each.words.length && inside(k + n) && word(k + n) === each.words[n]) n++;
          return { ...each, run: n >= Math.min(2, each.words.length) ? n : 0 };
        })
        .filter((each) => each.run > 0);
      const found =
        within.length === 1
          ? { ...within[0]!, end: tokenFrom(limit) }
          : runs.length === 1
            ? { ...runs[0]!, end: k + runs[0]!.run }
            : null;
      if (found !== null)
        return "index" in found
          ? answer(found.end, found.index)
          : choseWith(found.option, found.end);

      // 3. Yes or no.
      const yesWord = YES.has(word(k) ?? "");
      const yes = yesWord || reads(k, ["go", "ahead"], limit) || reads(k, ["do", "it"], limit);
      const yesEnd = yesWord ? k + 1 : k + 2;
      const no = NO.has(word(k) ?? "");
      const more = after(k + 1);
      if (card.kind === "permission") {
        const allow = options.find((option) => option.allows);
        if (yes && allow) return chose(allow, yesEnd, null);
        const note = has("declineWithNote");
        if (no && more?.text && note) return chose(note, k + 1, more);
        const decline = options.find(
          (option) => option.choice.kind === "decide" && option.choice.decision === "decline",
        );
        if (no && decline) return chose(decline, k + 1, null);
      }
      const offer = card.kind === "prose" && card.cue !== "question";
      const yesTo = offer
        ? has("goAhead")
        : card.kind === "plan"
          ? has("build")
          : card.kind === "failed"
            ? has("retry")
            : card.kind === "limit"
              ? (has("carryOn") ?? has("continueNow"))
              : null;
      if (yes && yesTo) return chose(yesTo, yesEnd, null);
      if (no && card.kind === "plan" && has("revise")) return chose(has("revise")!, k + 1, more);
      const noTo = offer ? has("nothingToDo") : card.kind === "failed" ? has("dismiss") : null;
      if (no && noTo && !more?.text) return chose(noTo, k + 1, null);

      // 4. Fixed verbs.
      return verb();
    };
    const verb = (): Read | "free" | null => {
      const found = VERBS.find(
        (v) => reads(k, v.words, limit) && v.kinds.some((kind) => kind === "open" || has(kind)),
      );
      if (!found) return null;
      const j = k + found.words.length;
      if (found.kinds[0] === "open") return closed(j, { kind: "open" });
      return choseWith(
        found.kinds.map(has).find((option) => option !== null)!,
        j,
      );
    };

    const read = fixed();
    if (read !== null && read !== "free") return read;

    // 5. A reply: "reply use staging", "tell it to wait", or words in quotes.
    const replyVerb = read === "free" ? undefined : REPLY_VERBS.find((p) => reads(k, p, limit));
    const open = /^[\s,:;—–-]*["“]/.exec(gapBefore(k));
    const quote = read === "free" || !open ? null : quotedAt(last(k) + open[0].length - 1, limit);
    if (replyVerb || quote) {
      let j = k + (replyVerb?.length ?? 0);
      if (replyVerb && ["with", "that", "to"].includes(word(j) ?? "")) j++;
      const said = quote ?? after(j);
      const reply = REPLIES.map(has).find((option) => option !== null) ?? null;
      if (reply) {
        const chosen = chose(reply, j, said);
        if (chosen !== "free") return chosen;
      }
      if (question?.other != null && said?.text) {
        if (NAMES_A_NUMBER.test(said.text)) return kept("numbers", said.end);
        return {
          reading: {
            kind: "answer",
            answers: { [question.id]: question.multiSelect ? [said.text] : said.text },
            label: `“${said.text}”`,
            pick: null,
          },
          end: said.end,
          free: false,
          form: formTo(j),
        };
      }
      return kept("unread", said?.end ?? last(j));
    }

    // 6. Free words: a reply, as said, to a card that takes one.
    const said = wordsIn(tokens[from]!.start, limit);
    const reply = has("reply") ?? has("stopAndReply");
    const why: Kept | null = NAMES_A_NUMBER.test(said.text)
      ? "numbers"
      : reply === null
        ? questions.length > 1
          ? "questions"
          : "unread"
        : null;
    return {
      reading:
        why === null ? { kind: "option", option: reply!, words: said.text } : { kind: "kept", why },
      end: said.end,
      free: true,
      form: null,
    };
  };

  /** A part's limit: the sentence's end, or the next part's anchor, whichever comes first. */
  const limitOf = (anchor: Anchor, taken: number, nested: boolean): number => {
    const end = sentenceEnd(anchor.end);
    if (nested) return end;
    for (let j = anchor.next + 1; j < tokens.length && tokens[j]!.start < end; j++) {
      if (!opens(j, taken)) continue;
      const next = anchorAt(j);
      if (next === null) continue;
      if (
        next.byName &&
        !next.numbers.some((n) => {
          const card = cardAt(n)!;
          const read = readAnswer(card, next.next, limitOf(next, taken, true));
          return !read.free && read.reading.kind !== "kept";
        })
      )
        continue;
      // From the joining words before it.
      let first = j;
      while (
        first > anchor.next &&
        JOINERS.has(word(first - 1) ?? "") &&
        !BOUNDARY.test(gapBefore(first))
      )
        first--;
      return tokens[first]!.start;
    }
    return end;
  };

  const parts: AnswerPart[] = [];
  const answered = new Set<number>();
  let taken = 0;
  for (let i = 0; i < tokens.length;) {
    const anchor = opens(i, taken) ? anchorAt(i) : null;
    if (anchor === null) {
      i++;
      continue;
    }
    const limit = limitOf(anchor, taken, false);
    let part: AnswerPart | null;
    if (anchor.missing !== null) {
      part = {
        start: anchor.start,
        end: trimmed(text, { start: anchor.start, end: limit }).end,
        anchor: { start: anchor.start, end: anchor.end },
        form: null,
        targets: [],
        missing: anchor.missing,
      };
    } else {
      const reads = anchor.numbers.map((number) => {
        const card = cardAt(number)!;
        return { number, card, read: readAnswer(card, anchor.next, limit) };
      });
      // A name holds only when an answer follows it; else "Otter, rebase"
      // is a message to Otter, which the composer reads.
      if (anchor.byName && reads.every(({ read }) => read.free || read.reading.kind === "kept")) {
        i++;
        continue;
      }
      const targets = reads.map(({ number, card, read }): Target => {
        const kept = (why: Kept): Target => ({
          number,
          reading: { kind: "kept", why },
          end: read.end,
        });
        if (card.gone) return kept("gone");
        if (anchor.byName && reads.length > 1) return kept("names");
        if (anchor.numbers.length > 1 && card.kind === "permission") return kept("list");
        if (answered.has(number) || card.held) return kept("twice");
        return { number, reading: read.reading, end: read.end };
      });
      for (const target of targets) answered.add(target.number);
      part = {
        start: anchor.start,
        end: Math.max(anchor.end, ...reads.map(({ read }) => read.end)),
        anchor: { start: anchor.start, end: anchor.end },
        form: reads[0]?.read.form ?? null,
        targets,
        missing: null,
      };
    }
    parts.push(part);
    taken = part.end;
    i = tokenFrom(part.end);
  }

  const rest: Span[] = [];
  let at = 0;
  for (const span of [...parts, { start: text.length, end: text.length }]) {
    const piece = trimmed(text, { start: at, end: span.start }, at > 0);
    if (/[\p{L}\p{N}]/u.test(text.slice(piece.start, piece.end))) rest.push(piece);
    at = span.end;
  }
  return { parts, spans: parts.map(({ start, end }) => ({ start, end })), rest };
}
