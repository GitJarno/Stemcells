// The model proposes, code decides (stemcells/tasks/aski-orchestrator.md, decision 4). The
// compiler's answer is data from a model: every field is checked against the message and the
// person's own projects and models before it becomes a plan, and each act's tier is set by
// what a mistake would cost, never by how sure the model sounds.

import { nearness } from "../recall/byEar.ts";
import { riskFindings } from "../risk/floor.ts";
import { clampEffort, findQuote, flat, nameWords, said, saysExactly } from "./names.ts";
import type { Piece } from "./pieces.ts";
import {
  CEILING,
  DICTATED_NOTE,
  type Act,
  type CompileContext,
  type DestroyAct,
  type ModelEntry,
  type ModelField,
  type PlaceEntry,
  type PlaceField,
  type Plan,
  type RiskMark,
  type Selection,
  type StartAct,
  type Why,
} from "./plan.ts";
import { wordsFor } from "./words.ts";

/** One act as the compiler answers it. Every field but `kind` and `pieces` may be missing. */
export interface AnswerAct {
  readonly kind: "start" | "new" | "destroy";
  readonly pieces: readonly number[];
  readonly place?: string | undefined;
  readonly placeHeard?: string | undefined;
  readonly model?: string | undefined;
  readonly modelHeard?: string | undefined;
  readonly effort?: string | undefined;
  readonly count?: number | undefined;
  readonly title?: string | undefined;
  readonly target?: "project" | "cells" | undefined;
  readonly cells?: readonly string[] | undefined;
  readonly after?: readonly number[] | undefined;
  readonly afterHeard?: string | undefined;
  readonly apart?: boolean | undefined;
  readonly apartHeard?: string | undefined;
}

export interface Answer {
  readonly acts: readonly AnswerAct[];
  readonly setup: readonly number[];
  readonly talk: readonly number[];
}

/** The longest title a row shows. */
const TITLE_MOST = 60;
/** How many words a title made from the Cell's own words takes. */
const TITLE_WORDS = 6;
/** The most words a model is read from: "the Fable 5 model", not a sentence that holds its name. */
const MODEL_WORDS = 4;
/** Words that say one thing waits for another: an `after` the person never said is dropped. */
const ORDER =
  /\b(?:after|afterwards|once|when|then|until|finish(?:es|ed)?|done|lands?|landed|completed?|ready)\b/iu;
/** Words that say a Cell works in a worktree of its own, and words that say it does not. */
const APART =
  /\bwork\s?trees?\b|\b(?:own|separate|different)\s+(?:copy|copies|branch|branches|checkout|clone)\b|\bisolat\w+/iu;
const TOGETHER =
  /\b(?:same|shared|main|project'?s?(?:\s+own)?)\s+(?:folder|checkout|directory)\b|\b(?:no|without(?:\s+an?y?)?)\s+work\s?trees?\b/iu;
/** How near a word before "agent" must be to a model's name: "soul agent" is Sol, "table agent" Fable. */
const MODEL_NEAR = 0.6;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
const numbersOf = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((n): n is number => Number.isInteger(n)) : [];

/** The answer, read loosely: a field of the wrong kind is a field left out. Null when it has no shape. */
export function readAnswer(value: unknown): Answer | null {
  if (!isRecord(value) || !Array.isArray(value.acts)) return null;
  const acts: AnswerAct[] = [];
  for (const one of value.acts) {
    if (!isRecord(one)) return null;
    const kind = one.kind;
    if (kind !== "start" && kind !== "new" && kind !== "destroy") return null;
    acts.push({
      kind,
      pieces: numbersOf(one.pieces),
      place: textOf(one.place),
      placeHeard: textOf(one.placeHeard),
      model: textOf(one.model),
      modelHeard: textOf(one.modelHeard),
      effort: textOf(one.effort),
      count: Number.isInteger(one.count) ? (one.count as number) : undefined,
      title: textOf(one.title),
      target: one.target === "project" || one.target === "cells" ? one.target : undefined,
      cells: Array.isArray(one.cells)
        ? one.cells.filter((c): c is string => typeof c === "string")
        : undefined,
      after: Array.isArray(one.after) ? numbersOf(one.after) : undefined,
      afterHeard: textOf(one.afterHeard),
      apart: typeof one.apart === "boolean" ? one.apart : undefined,
      apartHeard: textOf(one.apartHeard),
    });
  }
  return { acts, setup: numbersOf(value.setup), talk: numbersOf(value.talk) };
}

/** Words that lead up to a place's name and say nothing of a task: "and then in the …". */
const OPENING = new Set("and then also plus so ok okay in on for at into inside the".split(" "));

/** Every place the message names exactly, by where its name starts. */
function mentionsOf(
  text: string,
  places: readonly PlaceEntry[],
): Array<{ at: number; end: number; id: string }> {
  const out: Array<{ at: number; end: number; id: string }> = [];
  const lower = text.toLowerCase();
  for (const place of places) {
    for (const name of [place.name, ...(place.aliases ?? [])]) {
      const words = nameWords(name);
      if (words.length === 0) continue;
      const pattern = new RegExp(
        `(?<![\\p{L}\\p{N}])${words
          .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
          .join("[\\s_-]*")}(?![\\p{L}\\p{N}])`,
        "gu",
      );
      for (const match of lower.matchAll(pattern))
        out.push({ at: match.index, end: match.index + match[0].length, id: place.id });
    }
  }
  // "harbor-design" names Harbor Design, not Harbor: a name inside a longer one doesn't count.
  const whole = out.filter(
    (m) =>
      !out.some((o) => o !== m && o.at <= m.at && o.end >= m.end && o.end - o.at > m.end - m.at),
  );
  return whole.sort((a, b) => a.at - b.at);
}

const firstWords = (text: string, most: number) => text.split(/\s+/u).slice(0, most).join(" ");

function titleOf(title: string | undefined, words: string): string {
  const line = (title ?? firstWords(words, TITLE_WORDS)).replace(/\s+/gu, " ").trim();
  return line.length > TITLE_MOST ? `${line.slice(0, TITLE_MOST - 1)}…` : line;
}

/** A new project's name as a sidebar would write it: the person's words, each capitalised. */
const projectNameOf = (heard: string) =>
  heard
    .replace(/\s+/gu, " ")
    .trim()
    // "a new project called vacuum cleaners": the name is what follows.
    .replace(/^(?:(?:a|an|one|another)\s+)?(?:new\s+)?project\s+(?:called|named)\s+/iu, "")
    .replace(/(^|\s)(\p{Ll})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());

export interface PlanInput {
  readonly id: string;
  readonly text: string;
  readonly pieces: readonly Piece[];
  readonly answer: unknown;
  readonly context: CompileContext;
  /** A fresh thread id for each Cell. */
  readonly mint: () => string;
  /**
   * The last try: what would fail the answer instead weakens the plan (an unknown project is
   * left open, words given to no one make every act wait), so the person still gets a plan.
   */
  readonly final: boolean;
}

export type PlanResult =
  | { readonly ok: true; readonly plan: Plan }
  /** Each line says what was wrong, for the compiler's second try. */
  | { readonly ok: false; readonly failed: readonly string[] };

/** The plan an answer makes, or what was wrong with it. */
export function planOf(input: PlanInput): PlanResult {
  const { text, pieces, context, final } = input;
  const answer = readAnswer(input.answer);
  if (answer === null) return { ok: false, failed: ["The answer was not the JSON asked for."] };

  const failed: string[] = [];
  const numbers = new Set(pieces.map((piece) => piece.n));
  const valid = (list: readonly number[]) => [...new Set(list)].filter((n) => numbers.has(n));
  const byNumber = new Map(pieces.map((piece) => [piece.n, piece]));

  const taken = new Set<number>([...valid(answer.setup), ...valid(answer.talk)]);
  for (const act of answer.acts) for (const n of valid(act.pieces)) taken.add(n);
  const leftOver = pieces.map((piece) => piece.n).filter((n) => !taken.has(n));
  if (leftOver.length > 0 && !final)
    failed.push(`Pieces ${leftOver.join(", ")} appear in no act, in setup or in talk.`);

  const mentions = mentionsOf(text, context.places);

  const placeFor = (
    act: AnswerAct,
    mine: readonly number[],
  ): { field: PlaceField | null; why: Why[] } => {
    if (act.place === undefined) return { field: null, why: ["place-open"] };
    const heard =
      act.placeHeard !== undefined && findQuote(text, act.placeHeard) >= 0 ? act.placeHeard : null;
    const entry = context.places.find((place) =>
      saysExactly(act.place!, place.name, place.aliases),
    );
    if (entry === undefined) {
      if (act.kind === "new") {
        const name = projectNameOf(heard ?? act.place);
        return { field: { id: null, name, heard, how: "new" }, why: ["new-project"] };
      }
      if (!final) failed.push(`"${act.place}" is not in Projects: copy a name from the list.`);
      return { field: null, why: ["place-open"] };
    }
    // "A new project called Harbor" when Harbor exists: the person decides which they meant.
    if (act.kind === "new")
      return {
        field: { id: entry.id, name: entry.name, heard, how: "picked" },
        why: ["place-picked"],
      };
    if (heard === null)
      return {
        field: { id: entry.id, name: entry.name, heard, how: "picked" },
        why: ["place-picked"],
      };
    if (!saysExactly(heard, entry.name, entry.aliases))
      return { field: { id: entry.id, name: entry.name, heard, how: "near" }, why: ["place-near"] };
    // Said exactly: this Cell's when its own words name it first, or it was the last place said
    // before them. A name hanging at a piece's end with the next item right after it ("… the
    // seat map in Ledger one for the tax report") could be either's, so it counts for neither.
    const own = mine.map((n) => byNumber.get(n)!).sort((a, b) => a.start - b.start);
    const hangs = (m: (typeof mentions)[number]) => {
      const piece = pieces.find((p) => m.at >= p.start && m.at < p.end);
      const next = piece === undefined ? undefined : byNumber.get(piece.n + 1);
      // Within one Cell's own run of pieces the words simply go on.
      const goesOn = next !== undefined && mine.includes(piece!.n) && mine.includes(next.n);
      if (piece === undefined || next === undefined || m.end !== piece.end || goesOn) return false;
      // "then in Atlas" alone is no item's end: the name opens what follows.
      const lead =
        text
          .slice(piece.start, m.at)
          .toLowerCase()
          .match(/[\p{L}\p{N}]+/gu) ?? [];
      if (!lead.some((word) => !OPENING.has(word))) return false;
      // When what follows names a place of its own, this one ends its own item.
      return !mentions.some((o) => o.at >= next.start && o.at < next.end && o.id !== m.id);
    };
    const sure = mentions.filter((m) => !hangs(m));
    const first = sure.find((m) => own.some((piece) => m.at >= piece.start && m.at < piece.end));
    const before =
      own.length === 0 ? undefined : mentions.filter((m) => m.at < own[0]!.start).at(-1);
    const carried = before !== undefined && !hangs(before) && before.id === entry.id;
    // A message that names one place only means it for every Cell, wherever it stands.
    const only = mentions.every((m) => m.id === entry.id);
    const field: PlaceField = { id: entry.id, name: entry.name, heard, how: "exact" };
    const mineToo = first === undefined ? carried : first.id === entry.id;
    return { field, why: mineToo || only ? [] : ["place-apart"] };
  };

  /** Whether `heard` stands before "agent", "model" or "Cell", or after "model", somewhere in the message. */
  const asModel = (heard: string): boolean => {
    const words = flat(heard)
      .split(" ")
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join("\\s+");
    if (words.length === 0) return false;
    const spot = `(?<![\\p{L}\\p{N}])${words}(?![\\p{L}\\p{N}])`;
    return new RegExp(`${spot}\\s+(?:agents?|models?|cells?)\\b|\\bmodel\\s+${spot}`, "iu").test(
      text,
    );
  };

  const modelFor = (act: AnswerAct): ModelField | null => {
    // A model is the person's to name: one the compiler chose by itself is dropped.
    if (act.model === undefined || act.modelHeard === undefined) return null;
    if (findQuote(text, act.modelHeard) < 0) return null;
    const names = (model: ModelEntry) => [
      ...(model.aliases ?? []),
      // A family alone ("fable") means the model listed first under it.
      nameWords(model.name)[0] ?? model.name,
    ];
    const entry =
      context.models.find((model) => saysExactly(act.model!, model.name, model.aliases)) ??
      context.models.find((model) => saysExactly(act.model!, model.name, names(model)));
    if (entry === undefined) {
      if (!final) failed.push(`"${act.model}" is not in Models: copy a name from the list.`);
      return null;
    }
    const exact =
      saysExactly(act.modelHeard, entry.name, [...names(entry), entry.provider]) ||
      // "Fable 5" for Fable 5.1, "the fable model": the family is said.
      nameWords(act.modelHeard).includes(nameWords(entry.name)[0] ?? "");
    // A misheard model ("one table agent" for Fable) has to sound like it and stand where a
    // model does. "The users table" names none, and the Cell runs on its project's default.
    const heardNear =
      [entry.name, ...names(entry)].some((name) => nearness(act.modelHeard!, name) >= MODEL_NEAR) &&
      asModel(act.modelHeard);
    if (nameWords(act.modelHeard).length > MODEL_WORDS || (!exact && !heardNear)) return null;
    const level =
      act.effort !== undefined && effortSaid(act.effort)
        ? clampEffort(act.effort, entry.efforts)
        : null;
    return {
      instanceId: entry.instanceId,
      id: entry.id,
      name: entry.name,
      heard: act.modelHeard,
      how: exact ? "exact" : "near",
      effort:
        level !== null && entry.effortOption !== undefined
          ? { option: entry.effortOption, level }
          : null,
    };
  };

  /** An effort is the person's word too: one that isn't in the message is dropped. */
  const effortSaid = (effort: string) =>
    findQuote(text, effort) >= 0 ||
    (said(effort) === "xhigh" && /\b(?:extra|x|very)[\s-]*high\b/iu.test(text)) ||
    (said(effort) === "max" && /\b(?:max|maximum|highest)\b/iu.test(text));

  /** Where a Cell works is the person's word too: said in the message, in words that say so. */
  const apartFor = (act: AnswerAct): boolean | undefined => {
    if (act.apart === undefined || act.apartHeard === undefined) return undefined;
    if (findQuote(text, act.apartHeard) < 0) return undefined;
    const together = TOGETHER.test(act.apartHeard);
    if (act.apart) return APART.test(act.apartHeard) && !together ? true : undefined;
    return together ? false : undefined;
  };

  const acts: Act[] = [];
  const starts: StartAct[] = [];
  /** The Cells each act of the answer became, by the answer's own numbering. */
  const became: number[][] = [];
  for (const [at, one] of answer.acts.entries()) {
    became[at] = [];
    const mine = valid(one.pieces);
    if (mine.length === 0) {
      if (!final) failed.push("An act names no piece of the message.");
      continue;
    }
    if (one.kind === "destroy") {
      const { field } = placeFor({ ...one, kind: "start" }, mine);
      const cells = (one.cells ?? []).flatMap((name) =>
        context.cells.filter((cell) => said(cell.name) === said(name)),
      );
      const destroy: DestroyAct = {
        kind: "destroy",
        i: acts.length,
        pieces: mine,
        tier: "hold",
        why: [],
        target: one.target ?? (cells.length > 0 ? "cells" : "project"),
        place: field,
        cells,
        words: wordsFor(text, pieces, mine, []),
      };
      acts.push(destroy);
      continue;
    }
    const { field, why } = placeFor(one, mine);
    const model = modelFor(one);
    const words = wordsFor(
      text,
      pieces,
      mine,
      [field?.heard, model?.heard].filter((h): h is string => typeof h === "string"),
    );
    if (words.length === 0) continue;
    const risks: RiskMark[] = riskFindings(words)
      .filter((finding) => !finding.negated)
      .map(({ start, end, kind }) => ({ start, end, kind }));
    const count = Math.min(Math.max(one.count ?? 1, 1), CEILING);
    // Only toward earlier Cells, so nothing waits in a ring; only in the person's own words.
    const after =
      one.afterHeard !== undefined &&
      findQuote(text, one.afterHeard) >= 0 &&
      ORDER.test(one.afterHeard)
        ? [...new Set(one.after ?? [])].filter((n) => n >= 0 && n < at).flatMap((n) => became[n]!)
        : [];
    const apart = apartFor(one);
    for (let copy = 0; copy < count; copy++) {
      const start: StartAct = {
        kind: "start",
        i: acts.length,
        pieces: mine,
        threadId: input.mint(),
        title: titleOf(one.title, words),
        words,
        note: context.dictated ? DICTATED_NOTE : null,
        place: field,
        model,
        effort: one.effort !== undefined && effortSaid(one.effort) ? said(one.effort) : null,
        risks,
        tier: "start",
        why: [...why, ...(risks.length > 0 ? (["risky"] as const) : [])],
        ...(after.length > 0 ? { after, afterHeard: one.afterHeard! } : {}),
        ...(apart === undefined ? {} : { apart }),
      };
      became[at]!.push(start.i);
      acts.push(start);
      starts.push(start);
    }
  }
  if (failed.length > 0) return { ok: false, failed };

  // The tiers. A message that deletes is dealt with first; past the ceiling nothing more starts.
  const holds = acts.some((act) => act.kind === "destroy");
  const overCap = starts.length > context.cap;
  const kept = acts.filter((act) => act.kind === "destroy" || starts.indexOf(act) < CEILING);
  // An act past the ceiling is gone, and with it the wait for it.
  const moved = new Map(kept.map((act, i) => [act.i, i]));
  const tiered = kept.map((act, i): Act => {
    if (act.kind === "destroy") return { ...act, i };
    const { after: before, afterHeard, ...rest } = act;
    const after = (before ?? []).flatMap((n) => moved.get(n) ?? []);
    const why: Why[] = [
      ...act.why,
      ...(overCap ? (["over-cap"] as const) : []),
      ...(leftOver.length > 0 ? (["left-over"] as const) : []),
      ...(holds ? (["after-hold"] as const) : []),
      ...(context.always ? (["always"] as const) : []),
    ];
    return {
      ...rest,
      i,
      why,
      tier: why.length > 0 ? "check" : "start",
      ...(after.length > 0 && afterHeard !== undefined ? { after, afterHeard } : {}),
    };
  });

  return {
    ok: true,
    plan: {
      id: input.id,
      dictated: context.dictated,
      pieces,
      acts: tiered,
      talk: valid(answer.talk),
      leftOver,
      from: "read",
    },
  };
}

/** The plan when the compiler couldn't be read: nothing starts, and the message is Aski's chat's. */
export const floorPlan = (id: string, pieces: readonly Piece[], dictated: boolean): Plan => ({
  id,
  dictated,
  pieces,
  acts: [],
  talk: pieces.map((piece) => piece.n),
  leftOver: [],
  from: "floor",
});

/** One Cell as Aski's chat proposes it: the words are Aski's, so the person sees them first. */
export interface Proposal {
  readonly projectId: string;
  readonly projectName: string;
  readonly selection?: Selection | undefined;
  readonly title: string;
  readonly words: string;
}

/** A plan from Aski's chat. Every act waits for the person, whatever it says. */
export function proposedPlan(input: {
  readonly id: string;
  readonly cells: readonly Proposal[];
  readonly mint: () => string;
}): Plan {
  const acts = input.cells.slice(0, CEILING).map((cell, i): StartAct => {
    const words = cell.words.trim();
    const risks: RiskMark[] = riskFindings(words)
      .filter((finding) => !finding.negated)
      .map(({ start, end, kind }) => ({ start, end, kind }));
    return {
      kind: "start",
      i,
      pieces: [],
      threadId: input.mint(),
      title: titleOf(cell.title, words),
      words,
      note: null,
      place: {
        id: null,
        projectId: cell.projectId,
        name: cell.projectName,
        heard: null,
        how: "picked",
      },
      model: null,
      ...(cell.selection === undefined ? {} : { selection: cell.selection }),
      effort: null,
      risks,
      tier: "check",
      why: ["proposed", ...(risks.length > 0 ? (["risky"] as const) : [])],
    };
  });
  return {
    id: input.id,
    dictated: false,
    pieces: [],
    acts,
    talk: [],
    leftOver: [],
    from: "proposed",
  };
}
