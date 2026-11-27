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
const waiting = new Map<string, Array<(outcome: ReadonlyArray<ActOutcome>) => void>>();

function prune(now: number) {
  for (const [id, entry] of entries) if (now - entry.at > KEPT_MS) entries.delete(id);
  while (entries.size > MOST) entries.delete(entries.keys().next().value!);
}

export function putPlan(entry: Omit<BookEntry, "outcome">): void {
  prune(entry.at);
  entries.set(entry.plan.id, { ...entry, outcome: null });
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
      waiting.set(id, (waiting.get(id) ?? []).filter((one) => one !== tell));
      resolve(null);
    }, ms);
    waiting.set(id, [...(waiting.get(id) ?? []), tell]);
  });
}

/**
 * The plan a message to Aski's chat belongs to: the latest one made in that chat from the same
 * words, within `NOTE_MS`, that has something to carry out.
 */
export function planForMessage(threadId: string, text: string, now: number): BookEntry | null {
  const words = flat(text);
  let found: BookEntry | null = null;
  for (const entry of entries.values()) {
    if (entry.threadId !== threadId || now - entry.at > NOTE_MS) continue;
    if (entry.plan.acts.length === 0 || flat(entry.text) !== words) continue;
    if (found === null || entry.at >= found.at) found = entry;
  }
  return found;
}

/** For tests: forget every plan. */
export function clearBook(): void {
  entries.clear();
  waiting.clear();
}
