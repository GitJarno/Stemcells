/**
 * What a Cell started from words is sent: the message without its setup words ("Harbor fix the
 * header with Opus at max" sends "Fix the header"), or its [bracket] word for word. The draft's
 * text becomes that just before upstream's send reads it, and comes back if nothing was sent.
 * The draft's own Cell starts first (`cells.ts`). See `stemcells/tasks/prompting.md`, decision 9.
 */

import { createContext } from "react";

import type { Facts, Part } from "./read";
import type { Span } from "./text";

/** How the composer was told to send: Enter or Send, or ⌘↵ ("background"). */
export type SendIntent = "foreground" | "background" | "alternate" | undefined;

/** What the words do as the composer sends (`upstream/substitutes/ChatComposer.tsx`). */
export interface Sending {
  /** Nothing is sent: more Cells than the most, without ⌘↵ (decision 10). */
  readonly hold: boolean;
  /** Upstream sends once this settles: a word that acted only now has to show first. */
  readonly ready: Promise<void> | null;
  /** ⌘↵ that starts several Cells sends them here, not behind a fresh draft. */
  readonly foreground: boolean;
  /**
   * Makes the text what the draft's Cell is sent, just before upstream's
   * send reads it, and returns what to do once that send settles (with
   * what it returned); false when nothing is left to send after all.
   */
  readonly edit: () => ((sent: unknown) => void) | null | false;
}

/** Called as the composer sends; null when the words change nothing. */
export type BeforeSend = (intent: SendIntent) => Sending | null;

/**
 * Who reads a message's words as it sends, in the order they're asked:
 * answers to Aski's open cards first, then the Cells the words start.
 */
export type SendTurn = "answers" | "words";
const TURNS: readonly SendTurn[] = ["answers", "words"];

/**
 * How what reads the words hands the composer its `BeforeSend`, under its
 * turn; what it returns takes that one back, and only that one.
 */
export type SendRegister = (turn: SendTurn, beforeSend: BeforeSend) => () => void;

export const WordsSendSlot = createContext<SendRegister | null>(null);

/**
 * A composer's `BeforeSend`s, one per turn. Asked as it sends, the first
 * that changes the send decides it, so each reader can register in the
 * same composer without taking another's place.
 */
export function sendSlots(): {
  readonly register: SendRegister;
  readonly ask: (intent: SendIntent) => Sending | null;
} {
  const held = new Map<SendTurn, BeforeSend>();
  return {
    register: (turn, beforeSend) => {
      held.set(turn, beforeSend);
      return () => {
        if (held.get(turn) === beforeSend) held.delete(turn);
      };
    },
    ask: (intent) => {
      for (const turn of TURNS) {
        const sending = held.get(turn)?.(intent) ?? null;
        if (sending !== null) return sending;
      }
      return null;
    },
  };
}

/**
 * A composer's sends, one at a time. While one waits for its `ready` (a
 * word that acted only now showing, Aski thinking), the composer takes no
 * other; once `ready` settles the send goes. If it fails, nothing goes and
 * the composer takes the next send: a wait can never leave Enter dead.
 */
export function oneSendAtATime(): {
  readonly waiting: () => boolean;
  readonly send: (ready: Promise<void> | null, go: () => void) => void;
} {
  let waiting = false;
  return {
    waiting: () => waiting,
    send: (ready, go) => {
      if (ready === null) return go();
      waiting = true;
      ready.then(
        () => {
          waiting = false;
          go();
        },
        () => {
          waiting = false;
        },
      );
    },
  };
}

/** Replace `[start, end)` with `insert`. */
export interface Edit extends Span {
  readonly insert: string;
}

/** What a Cell's text becomes: the edits, and whether anything is left to send. */
export interface Outgoing {
  readonly edits: readonly Edit[];
  /** Nothing but setup words: nothing is sent, and the text stays. */
  readonly empty: boolean;
}

/** The characters no edit touches: code, and a list item's marker (`DocText`). */
export interface Kept {
  /** Code: sent as written, though the reader reads it as blank. */
  readonly code: ReadonlySet<number>;
  /** Characters the document doesn't hold: a list item's "- ". */
  readonly markers: ReadonlySet<number>;
}

/** Whether character `i` is something to send: a letter, a digit, a chip or code. */
function solid(text: string, kept: Kept, i: number): boolean {
  return kept.code.has(i) || /[\p{L}\p{N}\uFFFC]/u.test(text[i]!);
}

/**
 * What the text sends a Cell: its [bracket] word for word, or the text
 * without its setup words. Null when no word set anything up, so the text
 * goes as written.
 */
export function outgoingOf(facts: Facts, part: Part, kept: Kept): Outgoing | null {
  if (part.kind === "verbatim") {
    const verbatim = facts.verbatims[part.index]!;
    const inner = facts.text.indexOf(verbatim.text, verbatim.start);
    const edits: Edit[] = [];
    if (inner > 0) edits.push({ start: 0, end: inner, insert: "" });
    const after = inner + verbatim.text.length;
    if (after < facts.text.length) edits.push({ start: after, end: facts.text.length, insert: "" });
    let empty = true;
    for (let i = inner; i < after && empty; i++) empty = !solid(facts.text, kept, i);
    return { edits, empty };
  }
  return setupEdits(facts.text, facts.grammar, kept);
}

const SPACE = /[ \t]/;
const DANGLING = /[,;:—-]/;
const BEFORE_STOP = /[,.;:!?)]/;

/**
 * The edits that leave the setup words out (the spans the reader read as setup: an address, a
 * cue and its place, a model or effort phrase, a count), with the space or dangling punctuation
 * each leaves, raising the first letter when words before it went. A mention, quoted words and
 * code are never setup; no edit touches a character `kept` names. Null when no span goes.
 */
export function setupEdits(text: string, grammar: readonly Span[], kept: Kept): Outgoing | null {
  const keep = (i: number) => kept.code.has(i) || kept.markers.has(i);
  const gone = Array.from({ length: text.length }, () => false);
  for (const span of grammar)
    for (let i = span.start; i < span.end; i++) if (!keep(i)) gone[i] = true;
  if (!gone.includes(true)) return null;
  // Setup spans with only spaces between them go as one ("with Opus 5.5 at max").
  for (let i = 0, last = -1; i < text.length; i++) {
    if (!gone[i]) continue;
    if (last >= 0 && i - last > 1 && /^[ \t]+$/.test(text.slice(last + 1, i)))
      for (let k = last + 1; k < i; k++) if (!keep(k)) gone[k] = true;
    last = i;
  }
  const drop = (i: number) => {
    if (i >= 0 && i < text.length && !keep(i)) gone[i] = true;
  };
  const lineStart = (i: number) => i < 0 || text[i] === "\n";
  const lineEnd = (i: number) => i >= text.length || text[i] === "\n";

  // Tidy what each removed run leaves: its spaces, and punctuation that
  // only joined it to the rest.
  for (let i = 0; i < text.length;) {
    if (!gone[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end < text.length && gone[end]) end++;
    let before = i - 1;
    while (before >= 0 && SPACE.test(text[before]!) && !keep(before)) before--;
    let after = end;
    while (after < text.length && SPACE.test(text[after]!) && !keep(after)) after++;
    if (lineStart(before)) {
      // At the head of a line: the rest starts clean ("Harbor: fix" → "fix").
      for (let k = before + 1; k < after; k++) drop(k);
      while (after < text.length && DANGLING.test(text[after]!) && !keep(after)) drop(after++);
      while (after < text.length && SPACE.test(text[after]!)) drop(after++);
    } else if (lineEnd(after)) {
      // At the end of a line: the rest ends clean ("fix it, with Opus" → "fix it").
      for (let k = before + 1; k < after; k++) drop(k);
      while (before >= 0 && DANGLING.test(text[before]!) && !keep(before)) drop(before--);
      while (before >= 0 && SPACE.test(text[before]!) && !keep(before)) drop(before--);
    } else if (BEFORE_STOP.test(text[after]!)) {
      // Before punctuation: no space before it ("fix it in Harbor, now").
      for (let k = before + 1; k < after; k++) drop(k);
    } else {
      // Between words: one space stays.
      for (let k = before + 2; k < after; k++) drop(k);
    }
    i = end;
  }

  const edits: Edit[] = [];
  for (let i = 0; i < text.length;) {
    if (!gone[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end < text.length && gone[end]) end++;
    edits.push({ start: i, end, insert: "" });
    i = end;
  }
  // The first letter rises when the words before it went.
  const first = gone.findIndex((g, i) => !g && !/\s/.test(text[i]!));
  if (first > 0 && gone.slice(0, first).includes(true) && !keep(first)) {
    const letter = text[first]!;
    if (letter !== letter.toUpperCase())
      edits.push({ start: first, end: first + 1, insert: letter.toUpperCase() });
  }
  return { edits, empty: !gone.some((g, i) => !g && solid(text, kept, i)) };
}

/** `text` with the edits made: what the composer will hold. */
export function applyEdits(text: string, edits: readonly Edit[]): string {
  let out = text;
  for (const e of edits.toSorted((a, b) => b.start - a.start || b.end - a.end))
    out = out.slice(0, e.start) + e.insert + out.slice(e.end);
  return out;
}
