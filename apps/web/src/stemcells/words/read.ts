/**
 * The reader: what a message sets up before it's sent (how many Cells, which projects, models
 * and efforts, how the work is shared), from the words alone, locally on every keystroke and the
 * same on every screen. These facts are final: Aski's planner fills only what they leave open
 * and never changes them. The design: `stemcells/tasks/prompting.md`, decisions 1 to 11.
 */

import type { ModelLexicon } from "./catalog";
import { type EffortHit, type ModelHit, effortHits, modelHits } from "./models";
import { LIST_JOIN, type PlaceHit, type Roster, type RosterPlace, placeHits } from "./places";
import {
  DETERMINERS,
  FILLERS,
  IN_CUES,
  LAUNCH,
  LEADS,
  MODEL_CUES,
  NOUNS,
  SPAWN_NOUNS,
  type Span,
  type Token,
  bracketSpans,
  cleanWords,
  countOf,
  isVersion,
  lineStart,
  sameSentence,
  sentenceStart,
  timesOf,
  tokenize,
} from "./text";

/** Which composer is reading: a new chat (it has a project) or Aski's tab (it has none). */
export type Door = "draft" | "aski";

export interface ReadContext {
  readonly door: Door;
  readonly roster: Roster;
  readonly models: ModelLexicon;
  /** Live Cells' names, in Aski's chat: "Otter, rebase" speaks to Otter. */
  readonly cells?: readonly string[];
  /**
   * Spans another reader has taken, read as if blank: Aski's card answers
   * ("#2", "for 1: yes") are its own, and never a count or a place here.
   */
  readonly skip?: readonly Span[];
}

/** A live Cell named at the head of a message to Aski: "Otter, rebase onto main". */
export interface CellAddress extends Span {
  readonly name: string;
}

/** A count that asks for Cells without naming a model: "3 Cells", "3 Harbor:", "Harbor ×3". */
export interface CountHit extends Span {
  readonly count: number;
  readonly token: Token;
}

/** Text in [brackets] after a spawn noun or model: one Cell's prompt, word for word. */
export interface Verbatim extends Span {
  readonly text: string;
}

export interface CellGroup {
  /** Where the words introduce these Cells. */
  readonly start: number;
  readonly count: number;
  readonly model: ModelHit | null;
  readonly countHit: CountHit | null;
  readonly effort: EffortHit | null;
  /** The place the words point these Cells at; null means the draft's own, unless `open`. */
  readonly place: PlaceHit | null;
  /** No word points a place out, and Aski picks one (decision 10). */
  readonly open: boolean;
  /** Indexes into `Facts.verbatims`. */
  readonly verbatims: readonly number[];
}

/** How the work is shared among several Cells. */
export type Share =
  /** One Cell: it gets the message. */
  | "one"
  /** Each Cell has its own [bracket]. */
  | "verbatims"
  /** A pasted list, one item each. */
  | "items"
  /** Each Cell's words open a clause of their own. */
  | "clauses"
  /** A list of places with one task: each Cell gets the whole of it. */
  | "each"
  /** The words don't say: Aski's planner divides the work. */
  | "planner";

export type Part =
  | { readonly kind: "whole" }
  | { readonly kind: "verbatim"; readonly index: number }
  | ({ readonly kind: "item" } & Span)
  | ({ readonly kind: "clause" } & Span)
  | { readonly kind: "planner" };

export interface CellFact {
  /** Index into `Facts.groups`. */
  readonly group: number;
  readonly part: Part;
}

export interface Facts {
  /** The text as read: what `ReadContext.skip` and a Cell's address take read as blank. */
  readonly text: string;
  /** The live Cell the message speaks to, its name as typed; then it starts no Cells. */
  readonly cell: CellAddress | null;
  readonly tokens: readonly Token[];
  readonly groups: readonly CellGroup[];
  readonly cells: readonly CellFact[];
  readonly share: Share;
  /** Some Cell's place is open. */
  readonly open: boolean;
  /** The planner must be called: an open place, or work the words don't share out. */
  readonly needsPlan: boolean;
  /** The words ask for Cells. In Aski's tab, anything else is a message to Aski. */
  readonly launch: boolean;
  /** Places that route. */
  readonly routing: readonly PlaceHit[];
  /** Exact names the words only mention: a dotted underline, never a route. */
  readonly quiet: readonly PlaceHit[];
  /** The projects mentioned, once each, in order: the places Aski may pick from. */
  readonly mentions: readonly RosterPlace[];
  readonly models: readonly ModelHit[];
  readonly efforts: readonly EffortHit[];
  readonly counts: readonly CountHit[];
  readonly verbatims: readonly Verbatim[];
  /** The setup words, which a Cell's first message leaves out. */
  readonly grammar: readonly Span[];
  /** The message without its setup words. */
  readonly task: string;
}

interface Group {
  start: number;
  count: number;
  model: ModelHit | null;
  countHit: CountHit | null;
  effort: EffortHit | null;
  place: PlaceHit | null;
  /** "one in X" places a counted group shares itself out over. */
  subs: PlaceHit[];
  open: boolean;
  verbatims: number[];
}

const RANK = { address: 3, cue: 2, whole: 1, weak: 0, none: 0 } as const;
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+\S/;
const CLAUSE_CUT = /[.!?;](?=\s)|\n|,?\s+and\s+/g;

/**
 * Words that may stand before the address without taking it: a count, a
 * spawn verb, a model, "hey", "please". "3 Opus Harbor: …" is addressed to
 * Harbor.
 */
export function leadOf(models: ModelLexicon): (word: string) => boolean {
  return (w) =>
    LEADS.has(w) || models.words.has(w) || countOf(w) > 0 || isVersion(w) || timesOf(w) > 0;
}

export function readWords(source: string, ctx: ReadContext): Facts {
  const head =
    ctx.door === "aski" ? cellAddress(blank(source, ctx.skip ?? []), ctx.cells ?? []) : null;
  const cell = head?.cell ?? null;
  const text = blank(source, head ? [...(ctx.skip ?? []), head] : (ctx.skip ?? []));
  const tokens = tokenize(text);
  const isLead = leadOf(ctx.models);
  const placeWords = new Set(
    ctx.roster.places.filter((p) => !/\s/.test(p.place.name)).map((p) => p.joined),
  );

  const models = modelHits(text, tokens, ctx.models, isLead, placeWords);
  const inModel = (s: number, e: number) => models.some((m) => m.start < e && s < m.end);
  const places = placeHits(text, tokens, ctx.roster, inModel, isLead);
  let routing = places.filter(
    (h) => h.anchor === "address" || h.anchor === "cue" || h.anchor === "whole",
  );

  // Counts that ask for Cells without naming a model: "3 Cells". When a
  // model follows its cue ("a Cell with Opus", "3 Cells on Sol"), the count
  // is that model's.
  const counts: CountHit[] = [];
  tokens.forEach((t, i) => {
    if (t.literal || i === 0 || !SPAWN_NOUNS.has(t.norm)) return;
    const p = tokens[i - 1]!;
    if (models.some((m) => m.last === i - 1)) return;
    if (countOf(p.norm) === 0 || p.literal || /[.!?;:\n]/.test(text.slice(p.end, t.start))) return;
    // Cells are asked for at the head of a sentence, after a launch word or
    // a cue, or joined to Cells asked for before: "3 Cells fix …", "spawn 2
    // Cells", "Opus and 2 Cells", "Fable Cell […], another Cell […]", never
    // "explain how two cells divide".
    const said = cleanWords(text.slice(sentenceStart(text, p.start), p.start));
    const w0 = said[said.length - 1];
    const joined =
      (w0 === "and" ||
        w0 === "plus" ||
        /,\s*$/.test(text.slice(lineStart(text, p.start), p.start))) &&
      [...models, ...counts].some(
        (h) => h.start < p.start && lineStart(text, h.start) === lineStart(text, p.start),
      );
    if (
      !said.every(isLead) &&
      !(w0 !== undefined && (LAUNCH.has(w0) || MODEL_CUES.has(w0))) &&
      !joined
    )
      return;
    const hit: CountHit = { start: p.start, end: t.end, count: countOf(p.norm), token: p };
    const cue = tokens[i + 1];
    const model = models.findIndex((m) => m.first === i + 2);
    if (
      cue &&
      MODEL_CUES.has(cue.norm) &&
      model >= 0 &&
      !/[.!?;:\n]/.test(text.slice(t.end, models[model]!.start))
    ) {
      if (models[model]!.countToken === null)
        models[model] = { ...models[model]!, count: hit.count, countToken: p };
      return;
    }
    counts.push(hit);
  });
  // A count on the address place: "3 Harbor: …", "Harbor ×3 …".
  let header: CountHit | null = null;
  let headerPlace: PlaceHit | null = null;
  for (const h of routing) {
    if (h.anchor !== "address" || header) continue;
    const p = h.first > 0 ? tokens[h.first - 1]! : null;
    if (p && countOf(p.norm) > 0 && p.norm !== "a" && p.norm !== "an")
      header = { start: p.start, end: p.end, count: countOf(p.norm), token: p };
    const n = tokens[h.last + 1];
    if (n && timesOf(n.norm) > 0)
      header = { start: n.start, end: n.end, count: timesOf(n.norm), token: n };
    if (header) headerPlace = h;
  }

  const routed = models.length > 0 || routing.length > 0 || counts.length > 0;
  const efforts = effortHits(text, tokens, models, routed);

  // Groups: one per model, then per count.
  const fresh = (start: number, count: number): Group => ({
    start,
    count,
    model: null,
    countHit: null,
    effort: null,
    place: null,
    subs: [],
    open: false,
    verbatims: [],
  });
  let groups: Group[] = [
    ...models.map((m) => ({ ...fresh(m.start, m.count), model: m })),
    ...counts.map((c) => ({ ...fresh(c.start, c.count), countHit: c })),
  ];
  if (header && headerPlace) {
    if (groups.length === 1 && groups[0]!.count === 1) {
      groups[0]!.count = header.count;
      groups[0]!.countHit = header;
    } else if (groups.length === 0)
      groups.push({
        ...fresh(headerPlace.start, header.count),
        countHit: header,
        place: headerPlace,
      });
  }
  groups.sort((a, b) => a.start - b.start);

  // A list of places binds as its first place; the others join that
  // place's Cells once they are bound: "Harbor and Atlas: …".
  const lists = new Map<PlaceHit, PlaceHit[]>();
  routing.forEach((h, i) => {
    if (!h.listed || i === 0) return;
    const prior = routing[i - 1]!;
    const head = [...lists].find(([, members]) => members.includes(prior))?.[0] ?? prior;
    lists.set(head, [...(lists.get(head) ?? []), h]);
  });
  const member = (h: PlaceHit) => [...lists.values()].some((m) => m.includes(h));

  // Bind each routing place to the Cells it points at.
  let address: PlaceHit | null = null;
  const extra: PlaceHit[] = [];
  const perLine = routing.filter((h) => h.anchor === "address" && !member(h)).length >= 2;
  for (const h of routing) {
    if (member(h) || groups.some((g) => g.place === h)) continue;
    // Two or more lines that each open with a place: one Cell per line.
    if (perLine && h.anchor === "address") {
      const mine = groups.filter(
        (g) => !g.place && lineStart(text, g.start) === lineStart(text, h.start),
      );
      if (mine.length > 0) for (const g of mine) g.place = h;
      else groups.push({ ...fresh(h.start, 1), place: h });
      continue;
    }
    // "2 Cells, one in Harbor and one in Atlas": a counted group shares
    // itself out over its "one in X" places.
    const said = cleanWords(text.slice(sentenceStart(text, h.start), h.start));
    if (
      said.length >= 2 &&
      IN_CUES.has(said[said.length - 1]!) &&
      /^(one|another|other|1)$/.test(said[said.length - 2]!)
    ) {
      const parent = groups.findLast(
        (g) => g.start < h.start && g.count >= 2 && g.subs.length < g.count,
      );
      if (parent) {
        parent.subs.push(h);
        continue;
      }
    }
    const waiting = groups.filter(
      (g) => g.start < h.start && sameSentence(text, g.start, h.start) && !g.place,
    );
    if (
      (h.anchor === "address" || h.anchor === "whole") &&
      !groups.some((g) => g.start < h.start)
    ) {
      address ??= h;
      continue;
    }
    if (waiting.length > 0) {
      waiting[waiting.length - 1]!.place = h;
      continue;
    }
    const unplaced = groups.filter((g) => !g.place);
    if (groups.length === 1 && unplaced.length === 1) {
      unplaced[0]!.place = h;
      continue;
    }
    if (!address && h.anchor === "address") {
      address = h;
      continue;
    }
    // A Cell has one folder: two places pointed at with a cue in one
    // sentence are two Cells. "Fix the header in Harbor and the docs in
    // Atlas" starts one in each; the readout says so before Send.
    const owner = groups.find((g) => g.place && sameSentence(text, g.place.start, h.start));
    if (!address && h.anchor === "cue" && owner?.place?.anchor === "cue") {
      groups.push({ ...fresh(h.start, 1), place: h });
      continue;
    }
    // Any other second place in the sentence, or one after the address
    // named the place, is a mention: "Harbor fix X as it is in the Atlas
    // repo" starts in Harbor.
    if (address || owner) {
      extra.push(h);
      continue;
    }
    groups.push({ ...fresh(h.start, 1), place: h });
  }
  groups = groups.flatMap((g) => {
    if (g.subs.length === 0) return [g];
    const out: Group[] = g.subs.map((p) => ({
      ...g,
      start: p.start,
      count: 1,
      place: p,
      subs: [],
    }));
    if (g.count > g.subs.length) out.push({ ...g, count: g.count - g.subs.length, subs: [] });
    return out;
  });
  // One Cell takes one place, by the ladder: the address, then a cue, then
  // the whole message, the earliest first. The rest are mentions.
  const oneCell = !perLine && groups.length <= 1 && (groups.length === 0 || groups[0]!.count === 1);
  const bound = routing.filter((h) => !extra.includes(h) && !member(h));
  if (oneCell && bound.length > 1) {
    const win = bound
      .slice()
      .sort((a, b) => RANK[b.anchor] - RANK[a.anchor] || a.start - b.start)[0]!;
    for (const h of bound) if (h !== win) extra.push(h);
    if (groups.length > 0) groups[0]!.place = win;
    else address = win;
  }
  // A list whose first place is a mention is all mentions.
  for (const [head, members] of lists) if (extra.includes(head)) extra.push(...members);
  routing = routing.filter((h) => !extra.includes(h));
  for (const g of groups) if (g.place && extra.includes(g.place)) g.place = null;

  // A mention is an exact name written as the project writes it, inside a
  // sentence: "Atlas" mid-sentence is underlined, "the board" isn't the
  // Board project, and a sentence's capitalised first word ("Resume the
  // session") says nothing.
  const quiet = places.filter((h) => {
    if (routing.includes(h) || h.place.joined.length < 4) return false;
    if (cleanWords(text.slice(sentenceStart(text, h.start), h.start)).every(isLead)) return false;
    return !h.place.capital || /^\p{Lu}/u.test(h.heard);
  });
  const mentions: RosterPlace[] = [];
  for (const q of quiet) if (!mentions.includes(q.place)) mentions.push(q.place);

  groups.sort((a, b) => a.start - b.start);
  if (groups.length === 0) groups.push(fresh(0, 1));
  for (const e of efforts) {
    const before = groups.filter((g) => (g.model || g.countHit) && g.start < e.start);
    const g = before.length > 0 ? before[before.length - 1]! : groups[0]!;
    g.effort ??= e;
  }
  // The Cells a list's first place has, again in each of the others.
  for (const g of groups) if (!g.place && address) g.place = address;
  groups = groups.flatMap((g) => [
    g,
    ...(g.place ? (lists.get(g.place) ?? []) : []).map((place) => ({ ...g, place })),
  ]);
  const cellCount = groups.reduce((n, g) => n + g.count, 0);
  for (const g of groups) {
    if (!g.place && address) g.place = address;
    g.open = !g.place && (ctx.door === "aski" || (cellCount > 1 && mentions.length > 0));
  }

  // [Brackets] are verbatim prompts only in a message that asks for Cells:
  // "update the array [1, 2, 3]" keeps its literal.
  const spawnShaped =
    models.length > 0 || tokens.some((t) => !t.literal && SPAWN_NOUNS.has(t.norm));
  const verbatims: Verbatim[] = [];
  if (spawnShaped) {
    for (const b of bracketSpans(text)) {
      const inner = text.slice(b.start + 1, b.end - 1).trim();
      if (inner.length === 0) continue;
      const owner = groups.findLast((g) => g.start < b.start) ?? groups[0]!;
      owner.verbatims.push(verbatims.length);
      verbatims.push({ start: b.start, end: b.end, text: inner });
    }
  }

  const grammar = grammarSpans(text, tokens, models, efforts, routing, counts, header);
  for (const v of verbatims) grammar.push({ start: v.start, end: v.end });
  const share = shareOf(text, groups, cellCount, grammar);
  const items = share === "items" ? listItems(text) : [];
  const clauses = share === "clauses" ? clauseSpans(text) : [];
  const cells: CellFact[] = [];
  groups.forEach((g, gi) => {
    for (let k = 0; k < g.count; k++) {
      const n = cells.length;
      const part: Part =
        share === "one" || share === "each"
          ? { kind: "whole" }
          : share === "verbatims"
            ? { kind: "verbatim", index: g.verbatims[0]! }
            : share === "items"
              ? { kind: "item", ...items[n]! }
              : share === "clauses"
                ? { kind: "clause", ...clauseAt(clauses, g.start) }
                : { kind: "planner" };
      cells.push({ group: gi, part });
    }
  });
  const open = groups.some((g) => g.open);
  // Asking for Cells takes a model, a counted Cell ("a Cell", "3 Cells"), a
  // spawn word or a place at the address. "What's new in Harbor?" and "how
  // many cells are free?" ask Aski, not for a Cell.
  const launch =
    cell === null &&
    (models.length > 0 ||
      counts.length > 0 ||
      header !== null ||
      verbatims.length > 0 ||
      routing.some((h) => h.anchor === "address" || h.anchor === "whole") ||
      tokens.slice(0, 2).some((t) => t.norm === "spawn" || t.norm === "launch"));

  return {
    text,
    cell,
    tokens,
    groups: groups.map((g) => ({
      start: g.start,
      count: g.count,
      model: g.model,
      countHit: g.countHit,
      effort: g.effort,
      place: g.place,
      open: g.open,
      verbatims: g.verbatims,
    })),
    cells,
    share,
    open,
    needsPlan: open || share === "planner",
    launch,
    routing,
    quiet,
    mentions,
    models,
    efforts,
    counts: header ? [...counts, header] : counts,
    verbatims,
    grammar,
    task: cleanTask(text, grammar),
  };
}

/** The text with each span turned to spaces, so every offset still points where it did. */
function blank(text: string, spans: readonly Span[]): string {
  let out = text;
  for (const s of spans)
    out = out.slice(0, s.start) + " ".repeat(Math.max(0, s.end - s.start)) + out.slice(s.end);
  return out;
}

/**
 * "Otter, …" or "Otter: …" at the head of the message, for a live Cell
 * called Otter: the name, and the head the reader reads as blank.
 */
function cellAddress(
  text: string,
  cells: readonly string[],
): ({ readonly cell: CellAddress } & Span) | null {
  const m = /^(\s*@?)(\p{L}[\p{L}\p{N}-]*)\s*[,:]/u.exec(text);
  if (!m) return null;
  const name = cells.find((c) => c.toLowerCase() === m[2]!.toLowerCase());
  if (name === undefined) return null;
  const start = m[1]!.length;
  return { start: 0, end: m[0].length, cell: { start, end: start + m[2]!.length, name } };
}

function listItems(text: string): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const line of text.split("\n")) {
    if (LIST_ITEM.test(line)) {
      const lead = /^\s*(?:[-*•]|\d+[.)])\s+/.exec(line)![0].length;
      out.push({ start: at + lead, end: at + line.length });
    }
    at += line.length + 1;
  }
  return out;
}

/** Clauses: cut at a sentence end, a line, or "and"; the cuts belong to neither side. */
function clauseSpans(text: string): Span[] {
  const out: Span[] = [];
  let from = 0;
  for (const m of text.matchAll(CLAUSE_CUT)) {
    out.push({ start: from, end: m.index });
    from = m.index + m[0].length;
  }
  out.push({ start: from, end: text.length });
  return out;
}

function clauseAt(clauses: readonly Span[], pos: number): Span {
  return (
    clauses.find((c) => pos >= c.start && pos < c.end) ??
    clauses.findLast((c) => c.start <= pos) ??
    clauses[0]!
  );
}

function shareOf(
  text: string,
  groups: readonly Group[],
  cells: number,
  grammar: readonly Span[],
): Share {
  if (groups.every((g) => g.count === 1 && g.verbatims.length === 1)) return "verbatims";
  if (cells <= 1) return "one";
  if (listItems(text).length === cells && cells >= 2) return "items";
  if (groups.length > 1 && groups.every((g) => g.count === 1)) {
    const clauses = clauseSpans(text);
    const mine = groups.map((g) => clauseAt(clauses, g.start));
    const distinct = new Set(mine).size === mine.length;
    if (distinct && mine.every((c) => taskWords(text, c, grammar).length > 0)) return "clauses";
  }
  // "Harbor and Atlas: bump the client", "fix the header in Harbor and in
  // Atlas": one task, the same in each listed place.
  const places = groups.map((g) => g.place);
  if (
    groups.length > 1 &&
    groups.every((g) => g.count === 1) &&
    places.every((p, i) => p !== null && (i === 0 || p.listed)) &&
    new Set(places.map((p) => p!.place)).size === places.length
  )
    return "each";
  return "planner";
}

/** The setup words: models with their cues and nouns, efforts, routed places with their cues, counts. */
function grammarSpans(
  text: string,
  tokens: readonly Token[],
  models: readonly ModelHit[],
  efforts: readonly EffortHit[],
  routing: readonly PlaceHit[],
  counts: readonly CountHit[],
  header: CountHit | null,
): Span[] {
  const out: Span[] = [];
  for (const m of models) {
    let start = m.countToken && m.countToken.start < m.start ? m.countToken.start : m.start;
    const p = tokens[m.first - 1];
    if (p && MODEL_CUES.has(p.norm) && !(m.countToken && m.countToken.start < m.start))
      start = p.start;
    let end = m.end;
    const n = tokens[m.last + 1];
    if (n && SPAWN_NOUNS.has(n.norm)) end = n.end;
    if (m.countToken && m.countToken.start > m.start) end = Math.max(end, m.countToken.end);
    out.push({ start, end });
  }
  for (const e of efforts) out.push({ start: e.cue ? e.cue.start : e.start, end: e.end });
  routing.forEach((h, i) => {
    // "for" points the place out only after a Cell or a count ("a Cell for Atlas").
    const cue = (t: Token | undefined) =>
      t !== undefined && (IN_CUES.has(t.norm) || (t.norm === "for" && h.anchor === "cue"));
    let start = h.start;
    const p = tokens[h.first - 1];
    if (p && DETERMINERS.has(p.norm)) {
      const pp = tokens[h.first - 2];
      if (cue(pp)) start = pp!.start;
    } else if (cue(p)) start = p!.start;
    // A listed place takes the word that joins it: "Harbor and Atlas" goes whole.
    const prior = routing[i - 1];
    if (h.listed && prior && LIST_JOIN.test(text.slice(prior.end, h.start))) start = prior.end;
    let end = h.end;
    const n = tokens[h.last + 1];
    if (n && NOUNS.has(n.norm)) end = n.end;
    out.push({ start, end });
  });
  for (const c of counts) out.push({ start: c.start, end: c.end });
  if (header) out.push({ start: header.start, end: header.end });
  tokens.slice(0, 3).forEach((t) => {
    if (t.norm === "spawn" || t.norm === "start" || t.norm === "launch")
      out.push({ start: t.start, end: t.end });
  });
  return out;
}

function taskWords(text: string, range: Span, grammar: readonly Span[]): string[] {
  let out = "";
  for (let i = range.start; i < range.end; i++)
    out += grammar.some((r) => i >= r.start && i < r.end) ? " " : text[i];
  return cleanWords(out).filter((w) => !FILLERS.has(w));
}

/** The message without its setup words, tidied, with its first letter raised. */
export function cleanTask(text: string, grammar: readonly Span[], range?: Span): string {
  const a = range?.start ?? 0;
  const b = range?.end ?? text.length;
  let out = "";
  let cut = false;
  for (let i = a; i < b; i++) {
    const setup = grammar.some((r) => i >= r.start && i < r.end);
    if (!setup) out += text[i];
    else if (!cut) out += " ";
    cut = setup;
  }
  out = out
    .replace(/[ \t]+/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .trim()
    .replace(/^(?:(?:and|plus)\b|[,:;—-])+\s*/i, "")
    .replace(/^(?:(?:and|plus)\b|[,:;—-])+\s*/i, "")
    .replace(/[,;:—-]+$/, "")
    .trim();
  return out.length > 0 ? out[0]!.toUpperCase() + out.slice(1) : "";
}
