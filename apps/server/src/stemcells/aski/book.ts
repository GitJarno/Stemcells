// @effect-diagnostics globalTimers:off - plain promises a chat's turn waits on, kept outside the Effect runtime so the tools and the routes read one book.
// The plans Aski has made lately, on this server (stemcells/tasks/aski-orchestrator.md,
// decisions 1 and 5). A client asks for a plan, carries it out with the person's own access and
// says what came of it; Aski's chat reads that through `stemcells_plan`, so its one line names
// what really started. Kept in memory: a plan is minutes of work, and the plan history has the
// record.

import { flat } from "../../../../../stemcells/orchestrator/names.ts";
import type { Plan } from "../../../../../stemcells/orchestrator/plan.ts";

/** What became of one act. `waiting` is a check or a hold the person hasn't answered. */
export interface ActOutcome {
  readonly i: number;
  readonly status: "started" | "waiting" | "dropped" | "failed" | "called-back" | "done";
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
}

/** How long a plan stays readable. */
export const KEPT_MS = 2 * 60 * 60_000;
/** How long after a plan a message with its words still counts as that plan's message. */
export const NOTE_MS = 2 * 60_000;
const MOST = 200;

const entries = new Map<string, BookEntry>();
/** Plans a client said are coming: asked for, not yet made. */
const expected = new Map<
  string,
  { readonly threadId: string; readonly text: string; readonly at: number; readonly made: Array<() => void> }
>();
/** How long a plan may be on its way before a message stops waiting for it. */
export const MAKING_MS = 40_000;
const waiting = new Map<string, Array<(outcome: ReadonlyArray<ActOutcome>) => void>>();

function prune(now: number) {
  for (const [id, entry] of entries) if (now - entry.at > KEPT_MS) entries.delete(id);
  while (entries.size > MOST) entries.delete(entries.keys().next().value!);
}

export function putPlan(entry: Omit<BookEntry, "outcome">): void {
  prune(entry.at);
  entries.set(entry.plan.id, { ...entry, outcome: null });
  for (const tell of expected.get(entry.plan.id)?.made ?? []) tell();
  expected.delete(entry.plan.id);
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

/** What came of a plan, as its client tells it; later tellings replace earlier ones, act by act. */
export function settlePlan(id: string, acts: ReadonlyArray<ActOutcome>): boolean {
  const entry = entries.get(id);
  if (entry === undefined) return false;
  const known = new Set(entry.plan.acts.map((act) => act.i));
  const merged = new Map((entry.outcome ?? []).map((act) => [act.i, act]));
  for (const act of acts) if (known.has(act.i)) merged.set(act.i, act);
  const outcome = [...merged.values()].sort((a, b) => a.i - b.i);
  entries.set(id, { ...entry, outcome });
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
    if (flat(entry.text) !== words) continue;
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
  const words = flat(text);
  const coming = [...expected.values()].filter(
    (one) => one.threadId === threadId && flat(one.text) === words && now - one.at <= MAKING_MS,
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
}
