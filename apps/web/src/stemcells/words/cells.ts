/**
 * Several Cells from words alone (decision 9): when the words set every
 * Cell's place and share the work out themselves (a [bracket] each, a list
 * item each, a clause each), the Cells start at once, with no planner. This
 * says which Cells, each one's part, and what the readout reads back
 * (decision 10).
 * Anything else the words start several of, Aski's planner divides
 * (`plan/`).
 */

import { CHIP } from "./docText";
import type { InkKind } from "./ink";
import type { CellGroup, Facts, Part, Share } from "./read";
import { cleanTask } from "./read";
import type { Span } from "./text";

/** The most Cells one message starts before only ⌘↵ sends (Settings › Aski). */
export const MOST_CELLS = 6;

export interface LaunchCell {
  readonly group: CellGroup;
  /** Its [bracket], or its share of the message (a clause, a list item), or the whole. */
  readonly part: Part;
}

export interface Launch {
  readonly share: Share;
  readonly cells: readonly LaunchCell[];
  /** Only Aski's planner can share the work out: Enter asks it first. */
  readonly held?: boolean;
}

/** The Cells the words start alone; null when they start one, or Aski must plan. */
export function launchOf(facts: Facts): Launch | null {
  if (facts.cell !== null || facts.open || facts.needsPlan || facts.cells.length < 2) return null;
  return {
    share: facts.share,
    cells: facts.cells.map((cell) => ({ group: facts.groups[cell.group]!, part: cell.part })),
  };
}

/**
 * Cells the words start that only Aski's planner can share the work out
 * to: "Sol and Opus: fix the header", "fix the header in Harbor so it
 * matches the one in Atlas". Enter asks it first, and the message loses
 * no word while it thinks; with no planner to ask it holds, and the
 * readout says what the words still need.
 */
export function heldOf(facts: Facts): Launch | null {
  if (facts.cell !== null || facts.cells.length < 2 || launchOf(facts) !== null) return null;
  return {
    share: facts.share,
    cells: facts.cells.map((cell) => ({ group: facts.groups[cell.group]!, part: cell.part })),
    held: true,
  };
}

/** The message as written: `raw`, with the characters in `code` (read as blank). */
export interface Written {
  readonly raw: string;
  readonly code: ReadonlySet<number>;
}

/**
 * A Cell's own part, as it reads in its message: its clause or its list
 * item without the setup words, its code as written in backticks. Null for
 * a Cell that has none.
 */
export function partOf(facts: Facts, part: Part, written?: Written): string | null {
  if (part.kind !== "clause" && part.kind !== "item") return null;
  const write = written ?? { raw: facts.text, code: new Set<number>() };
  const { text, span } = ticked(write);
  const grammar = facts.grammar.map(span);
  return cleanTask(text, grammar, span(widened(part, write))) || null;
}

/**
 * The part with the code at either end that the reader's cuts took as
 * blank ("and `cart.ts` is wrong"): out over code and spaces, up to a word.
 */
function widened(part: Span, { raw, code }: Written): Span {
  const loose = (i: number) => code.has(i) || raw[i] === " " || raw[i] === "\t";
  let { start, end } = part;
  while (start > 0 && loose(start - 1)) start--;
  while (end < raw.length && loose(end)) end++;
  return { start, end };
}

/**
 * The text with each run of code on a line in backticks, as upstream sends
 * it, and its chips left out, and where a span of the text before now sits.
 */
function ticked({ raw, code }: Written): { text: string; span: (s: Span) => Span } {
  const inCode = (i: number) => code.has(i) && raw[i] !== "\n";
  const from: number[] = [];
  const to: number[] = [];
  let text = "";
  for (let i = 0; i < raw.length; i++) {
    from.push(text.length);
    if (inCode(i) && !inCode(i - 1)) text += "`";
    if (raw[i] !== CHIP) text += raw[i];
    if (inCode(i) && !inCode(i + 1)) text += "`";
    to.push(text.length);
  }
  const span = (s: Span): Span => {
    const start = from[s.start] ?? text.length;
    return { start, end: s.end > s.start ? to[s.end - 1]! : start };
  };
  return { text, span };
}

/**
 * A Cell's message when it shares one: the message without its setup
 * words, so it sees what the others do, then its part, so it leaves the
 * rest alone.
 */
export function withPart(whole: string, part: string): string {
  return whole.trim().length === 0 ? part : `${whole}\n\n${partLine(part)}`;
}

/** "Your part: fix the header. Others are doing the rest." */
export function partLine(part: string): string {
  return `Your part: ${part.replace(/[\s.;,:!]+$/, "")}. Others are doing the rest.`;
}

/** A word the readout reads back: the word in the message, which opens its menu, or a default. */
export interface ReadoutWord {
  readonly text: string;
  /** The word it reads back; null for a default, which is dim and has no plate. */
  readonly mark: ({ readonly kind: InkKind } & Span) | null;
  /** Aski chose it: the place of an open Cell, in a plan. */
  readonly aski?: boolean;
}

export interface ReadoutGroup {
  readonly count: ReadoutWord | null;
  readonly model: ReadoutWord | null;
  readonly effort: ReadoutWord | null;
  readonly place: ReadoutWord | null;
}

export interface Readout {
  readonly total: number;
  /** Past the most Cells: the count wears the warning edge, and only ⌘↵ sends. */
  readonly over: boolean;
  /** The words don't say what each Cell does, and no planner can: nothing is sent (`heldOf`). */
  readonly held: boolean;
  /** Aski's plan, while it thinks and once it waits for a second Enter. */
  readonly plan?: ReadoutPlan;
  readonly most: number;
  readonly groups: readonly ReadoutGroup[];
  /** How the work is shared, in a few words. */
  readonly share: string;
}

/**
 * Aski's plan in the readout: thinking, or waiting for Enter to start it
 * (a place Aski picked, or the floor, with why). A floor with a place left
 * open can't start: the words have to say where.
 */
export type ReadoutPlan =
  | { readonly state: "thinking" }
  | {
      readonly state: "check";
      readonly why: string | null;
      readonly startable: boolean;
      /** A risky act Aski wrote that the words don't ask for: only ⌘↵ starts it (decision 17). */
      readonly risk?: string;
    };

/** What a readout fills in that the words don't say: the defaults, by place (null: the draft's). */
export interface ReadoutDefaults {
  readonly model: (placeId: string | null) => string | null;
  readonly place: string | null;
  readonly effortLabel: (level: string) => string;
}

const SHARE: Partial<Record<Share, string>> = {
  verbatims: "word for word",
  items: "one list item each",
  clauses: "each its own part",
  each: "the same task in each",
  planner: "Aski divides the work",
};

/** The places a readout starts Cells in, each once, in the words' order: what the hero names. */
export function placesOf(readout: Readout): string[] {
  return [...new Set(readout.groups.flatMap((g) => (g.place ? [g.place.text] : [])))];
}

/** The words read back as one sentence: "3 Cells: 2 Sol 6.1 in Harbor, Opus 5.5 at Max in Atlas". */
export function readoutOf(launch: Launch, defaults: ReadoutDefaults, most = MOST_CELLS): Readout {
  const groups: ReadoutGroup[] = [];
  const seen = new Set<CellGroup>();
  for (const { group } of launch.cells) {
    if (seen.has(group)) continue;
    seen.add(group);
    groups.push(wordsOf(group, defaults));
  }
  const total = launch.cells.length;
  return {
    total,
    over: total > most,
    held: launch.held === true,
    most,
    groups,
    share: SHARE[launch.share] ?? "",
  };
}

/** A Cell group's words read back: its count, model, effort and place, defaults dim. */
function wordsOf(group: CellGroup, defaults: ReadoutDefaults): ReadoutGroup {
  const placeId = group.place?.place.place.id ?? null;
  // "Codex" names its provider's default model.
  const form = group.model?.form;
  const named = form
    ? (form.model?.name ??
      form.provider.models.find((m) => m.id === form.provider.defaultModel)?.name ??
      form.provider.name)
    : null;
  const fallback = named === null ? defaults.model(placeId) : null;
  const countToken = group.countHit?.token ?? group.model?.countToken ?? null;
  return {
    count:
      group.count > 1
        ? {
            text: String(group.count),
            mark: countToken
              ? { kind: "count", start: countToken.start, end: countToken.end }
              : null,
          }
        : null,
    model: group.model
      ? { text: named!, mark: { kind: "model", start: group.model.start, end: group.model.end } }
      : fallback === null
        ? null
        : { text: fallback, mark: null },
    effort: group.effort
      ? {
          text: defaults.effortLabel(group.effort.level),
          mark: { kind: "effort", start: group.effort.start, end: group.effort.end },
        }
      : null,
    place: group.place
      ? {
          text: group.place.place.place.name,
          mark: { kind: "place", start: group.place.start, end: group.place.end },
        }
      : // An open place is Aski's to pick, not the draft's.
        group.open || defaults.place === null
        ? null
        : { text: defaults.place, mark: null },
  };
}

/** Each Cell's words read back, in the launch's order. */
export function cellWords(launch: Launch, defaults: ReadoutDefaults): ReadoutGroup[] {
  const words = new Map<CellGroup, ReadoutGroup>();
  return launch.cells.map(({ group }) => {
    const read = words.get(group) ?? wordsOf(group, defaults);
    words.set(group, read);
    return read;
  });
}

/** Each Cell's readout words, in the launch's order: "Sol 6.1 · Harbor". */
export function cellTitles(launch: Launch, defaults: ReadoutDefaults): string[] {
  return cellWords(launch, defaults).map((read) =>
    [read.model?.text, read.place?.text].filter(Boolean).join(" · "),
  );
}
