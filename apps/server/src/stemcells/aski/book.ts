// @effect-diagnostics globalTimers:off - plain promises a chat's turn waits on, kept outside the Effect runtime so the tools and the routes read one book.
// The plans Aski has made lately, on this server (stemcells/tasks/aski-orchestrator.md,
// decisions 1 and 5). A client asks for a plan, carries it out with the person's own access and
// says what came of it; Aski's chat reads that through `stemcells_plan`, so its one line names
// what really started. The book is read from memory and kept on disk (`Keeper.ts`), so a plan
// outlives a restart and stands under its message (decision 15).

import type { Plan, StartAct } from "../../../../../stemcells/orchestrator/plan.ts";
import {
  type KeptPlan,
  PLAN_NOTE_MS,
  planWords,
} from "../../../../../stemcells/orchestrator/wire.ts";

/** What became of one act. `waiting` is a check or a hold the person hasn't answered. */
export interface ActOutcome {
  readonly i: number;
  readonly status: "started" | "waiting" | "queued" | "dropped" | "failed" | "called-back" | "done";
  /** Why it failed, for Aski's line. */
  readonly reason?: string | undefined;
}

export interface BookEntry {
  readonly plan: Plan;
  /** The message it was made from. */
  readonly text: string;
  /** Aski's chat it was said in; null for none. */
  readonly threadId: string | null;
  readonly at: number;
  readonly outcome: ReadonlyArray<ActOutcome> | null;
  /** The message in Aski's chat it was made from, once that message's turn began. */
  readonly messageId: string | null;
  /** What each queued act starts with, by act, as its client handed it over (`line.ts`). */
  readonly launches?: Readonly<Record<string, Launch>>;
}

/** What a queued Cell starts with: what its client would have started it with. */
export interface Launch {
  readonly projectId: string;
  /** The model as a launch takes it, checked where it is handed over. */
  readonly modelSelection: unknown;
  readonly runtimeMode: string;
  readonly interactionMode: string;
  /** In a worktree of its own, when the project's folder is a repository. */
  readonly worktree: boolean;
  /** When it was handed over, in epoch milliseconds. */
  readonly at: number;
  /** The person won't wait for the Cells it comes after: it starts at once. */
  readonly now?: boolean;
}

/** How a Cell stands, as the needs list has it (`needs/stage.ts`). */
export interface Standing {
  readonly stage: "working" | "needs-you" | "done";
  /** Its own word: what it delivered, or what is left. */
  readonly line: string | null;
  readonly landing: {
    readonly verdict: "shown" | "claimed" | "short";
    readonly proof: string;
  } | null;
}

/** How long a plan stays readable. */
const KEPT_MS = 30 * 24 * 60 * 60_000;
const NOTE_MS = PLAN_NOTE_MS;
const MOST = 200;
/** How long a plan's Cells are still news to Aski's chat. */
const NEWS_MS = 7 * 24 * 60 * 60_000;
/** The most Cells one note tells of. */
const NEWS_MOST = 8;
const TOLD_MOST = 2_000;

const entries = new Map<string, BookEntry>();
/** Plans a client said are coming: asked for, not yet made. */
const expected = new Map<
  string,
  {
    readonly threadId: string;
    readonly text: string;
    readonly at: number;
    readonly made: Array<() => void>;
  }
>();
/** How long a plan may be on its way before a message stops waiting for it. */
const MAKING_MS = 40_000;
const waiting = new Map<string, Array<(outcome: ReadonlyArray<ActOutcome>) => void>>();

const wordsOf = planWords;
/** Called on every change worth keeping. */
const changed = new Set<() => void>();
const touch = () => {
  for (const tell of changed) tell();
};
let standings: ReadonlyMap<string, Standing> = new Map();
/** What Aski's chat was last told of a Cell, as `chat\tcell`. */
const told = new Map<string, string>();

function prune(now: number) {
  for (const [id, entry] of entries) if (now - entry.at > KEPT_MS) entries.delete(id);
  while (entries.size > MOST) entries.delete(entries.keys().next().value!);
}

export function putPlan(entry: Omit<BookEntry, "outcome" | "messageId">): void {
  prune(entry.at);
  entries.set(entry.plan.id, { ...entry, outcome: null, messageId: null });
  for (const tell of expected.get(entry.plan.id)?.made ?? []) tell();
  expected.delete(entry.plan.id);
  touch();
}

/** The book as it is kept on disk. */
export const keptBook = (): ReadonlyArray<BookEntry> => [...entries.values()];

/** The book as it was kept, read once when the server starts: a plan made since stays as it is. */
export function hydrateBook(kept: ReadonlyArray<BookEntry>, now: number): void {
  const fresh = [...entries.values()];
  entries.clear();
  for (const entry of [...kept].sort((a, b) => a.at - b.at)) entries.set(entry.plan.id, entry);
  for (const entry of fresh) entries.set(entry.plan.id, entry);
  prune(now);
}

/** Runs `tell` each time the book changes; returns its stop. */
export function onBookChange(tell: () => void): () => void {
  changed.add(tell);
  return () => void changed.delete(tell);
}

/** The message a plan was made from, as its turn names it. The first to be tied stays. */
export function tieMessage(id: string, messageId: string): void {
  const entry = entries.get(id);
  if (entry === undefined || entry.messageId !== null) return;
  entries.set(id, { ...entry, messageId });
  touch();
}

/** A deletion of this plan still waits for the person's hand: nothing of it starts before. */
const heldOf = (entry: BookEntry): boolean =>
  entry.plan.acts.some((act) => {
    if (act.kind !== "destroy") return false;
    const status = entry.outcome?.find((one) => one.i === act.i)?.status;
    return status !== "done" && status !== "dropped";
  });

/**
 * A client hands the server a Cell to start itself (decision 16). Refused for a plan or a Cell
 * the book doesn't have, and while a deletion of the plan is held.
 */
export function queueAct(
  id: string,
  i: number,
  launch: Launch,
): "queued" | "started" | "unknown" | "held" {
  const entry = entries.get(id);
  const act = entry?.plan.acts.find((one) => one.i === i);
  if (entry === undefined || act === undefined || act.kind !== "start") return "unknown";
  if (heldOf(entry)) return "held";
  // Handed over twice, by a second window or a retry: the Cell is one already.
  if (entry.outcome?.find((one) => one.i === i)?.status === "started") return "started";
  const outcome = [
    ...(entry.outcome ?? []).filter((one) => one.i !== i),
    { i, status: "queued" as const },
  ].sort((a, b) => a.i - b.i);
  entries.set(id, { ...entry, outcome, launches: { ...entry.launches, [i]: launch } });
  touch();
  return "queued";
}

/** The plans made in one of Aski's chats, newest first. */
export function plansOf(threadId: string, most = 40): KeptPlan[] {
  return [...entries.values()]
    .filter((entry) => entry.threadId === threadId && entry.plan.acts.length > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, most)
    .map((entry) => ({
      id: entry.plan.id,
      at: entry.at,
      messageId: entry.messageId,
      words: wordsOf(entry.text),
      plan: entry.plan,
      outcome: entry.outcome,
    }));
}

/** Every Cell's standing, as the needs list last had it. */
export function setStandings(cells: ReadonlyArray<{ readonly threadId: string } & Standing>): void {
  standings = new Map(
    cells.map((cell) => [
      cell.threadId,
      { stage: cell.stage, line: cell.line, landing: cell.landing },
    ]),
  );
}

export const standingOf = (threadId: string): Standing | null => standings.get(threadId) ?? null;

const signatureOf = (standing: Standing) =>
  `${standing.stage}\t${standing.landing?.verdict ?? ""}\t${standing.line ?? ""}`;

/** The Cells of `entry` that started, each with its standing when it has one. */
const startedOf = (entry: BookEntry): Array<{ act: StartAct; standing: Standing | null }> =>
  entry.plan.acts.flatMap((act) =>
    act.kind === "start" && entry.outcome?.find((one) => one.i === act.i)?.status === "started"
      ? [{ act, standing: standingOf(act.threadId) }]
      : [],
  );

/** Aski's chat has now read how this plan's Cells stand: none of it is news again. */
export function markTold(entry: BookEntry): void {
  if (entry.threadId === null) return;
  for (const { act, standing } of startedOf(entry)) {
    if (standing === null) continue;
    const key = `${entry.threadId}\t${act.threadId}`;
    told.delete(key);
    told.set(key, signatureOf(standing));
  }
  while (told.size > TOLD_MOST) told.delete(told.keys().next().value!);
}

/**
 * The Cells Aski's chat `threadId` started that landed or asked since it was last told, each
 * told once. A Cell at work is no news.
 */
export function newsFor(
  threadId: string,
  now: number,
): Array<{ act: StartAct; standing: Standing }> {
  const news: Array<{ act: StartAct; standing: Standing }> = [];
  for (const entry of entries.values()) {
    if (entry.threadId !== threadId || now - entry.at > NEWS_MS) continue;
    for (const { act, standing } of startedOf(entry)) {
      if (standing === null || standing.stage === "working") continue;
      const key = `${threadId}\t${act.threadId}`;
      if (told.get(key) === signatureOf(standing) || news.length >= NEWS_MOST) continue;
      told.delete(key);
      told.set(key, signatureOf(standing));
      news.push({ act, standing });
    }
  }
  while (told.size > TOLD_MOST) told.delete(told.keys().next().value!);
  return news;
}

/**
 * A client says a plan is being made from a message it is about to send to Aski's chat. The
 * message can then reach the chat first: its turn waits for the plan (`planForMessage`).
 */
export function expectPlan(input: {
  readonly id: string;
  readonly threadId: string;
  readonly text: string;
  readonly at: number;
}): void {
  for (const [id, one] of expected) if (input.at - one.at > MAKING_MS) expected.delete(id);
  if (!entries.has(input.id)) expected.set(input.id, { ...input, made: [] });
}

/** A plan that will never come (its compile failed before it began): nothing waits for it. */
export function unexpectPlan(id: string): void {
  for (const tell of expected.get(id)?.made ?? []) tell();
  expected.delete(id);
}

export const planOfId = (id: string): BookEntry | null => entries.get(id) ?? null;

/**
 * What came of a plan, as its client tells it; later tellings replace earlier ones, act by act.
 * `byLine` is the server's own word for a Cell it started or couldn't, which nothing overrules.
 */
export function settlePlan(id: string, acts: ReadonlyArray<ActOutcome>, byLine = false): boolean {
  const entry = entries.get(id);
  if (entry === undefined) return false;
  const known = new Set(entry.plan.acts.map((act) => act.i));
  const merged = new Map((entry.outcome ?? []).map((act) => [act.i, act]));
  for (const act of acts) {
    if (!known.has(act.i)) continue;
    // A client's "queued" is its own view: it never undoes what the server already did with the act.
    const now = merged.get(act.i)?.status;
    if (
      !byLine &&
      act.status === "queued" &&
      now !== undefined &&
      now !== "waiting" &&
      now !== "queued"
    )
      continue;
    // Nor does its "started" take a Cell out of the server's hands before the server started it.
    if (!byLine && act.status === "started" && entry.launches?.[act.i] !== undefined) continue;
    merged.set(act.i, act);
  }
  const outcome = [...merged.values()].sort((a, b) => a.i - b.i);
  // An act told as anything but queued is no longer the server's to start.
  const launches = Object.fromEntries(
    Object.entries(entry.launches ?? {}).filter(
      ([i]) => merged.get(Number(i))?.status === "queued",
    ),
  );
  entries.set(id, { ...entry, outcome, launches });
  touch();
  for (const tell of waiting.get(id) ?? []) tell(outcome);
  waiting.delete(id);
  return true;
}

/** The plan's outcome once a client has told it, or null after `ms` without one. */
export function outcomeOf(id: string, ms: number): Promise<ReadonlyArray<ActOutcome> | null> {
  const entry = entries.get(id);
  if (entry === undefined) return Promise.resolve(null);
  if (entry.outcome !== null) return Promise.resolve(entry.outcome);
  return new Promise((resolve) => {
    const tell = (outcome: ReadonlyArray<ActOutcome>) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => {
      const left = (waiting.get(id) ?? []).filter((one) => one !== tell);
      if (left.length === 0) waiting.delete(id);
      else waiting.set(id, left);
      resolve(null);
    }, ms);
    waiting.set(id, [...(waiting.get(id) ?? []), tell]);
  });
}

function madeFor(threadId: string, words: string, now: number): BookEntry | null {
  let found: BookEntry | null = null;
  for (const entry of entries.values()) {
    if (entry.threadId !== threadId || now - entry.at > NOTE_MS) continue;
    if (wordsOf(entry.text) !== words) continue;
    if (found === null || entry.at >= found.at) found = entry;
  }
  return found;
}

/**
 * The plan a message to Aski's chat belongs to: the latest one made in that chat from the same
 * words, within `NOTE_MS`, that has something to carry out. A plan still being made is waited
 * for, at most `MAKING_MS`. Null when there is none: the message is Aski's chat's alone.
 */
export async function planForMessage(
  threadId: string,
  text: string,
  now: number,
): Promise<BookEntry | null> {
  const words = wordsOf(text);
  const coming = [...expected.values()].filter(
    (one) => one.threadId === threadId && wordsOf(one.text) === words && now - one.at <= MAKING_MS,
  );
  if (coming.length > 0)
    await Promise.all(
      coming.map(
        (one) =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, MAKING_MS);
            one.made.push(() => {
              clearTimeout(timer);
              resolve();
            });
          }),
      ),
    );
  // A plan made while this waited is younger than `now`.
  const found = madeFor(threadId, words, now + (coming.length > 0 ? MAKING_MS : 0));
  return found !== null && found.plan.acts.length > 0 ? found : null;
}

/** For tests: forget every plan. */
export function clearBook(): void {
  entries.clear();
  waiting.clear();
  expected.clear();
  told.clear();
  standings = new Map();
}
