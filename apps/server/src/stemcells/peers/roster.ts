// Who's here (stemcells/tasks/peers.md, decision 6): every Cell knows its
// own name and one-liner, and the other Cells at work in its repository,
// told at a turn's start only when that list changed since it was last told.
// The the original app roster cost millions of tokens by riding every tool call;
// once per change costs a line or two.

import { cellNameOf } from "../../../../../stemcells/words/cellNames.ts";
import { ASKI_INSTANCE_ID } from "../needs/derive.ts";
import { titleOf } from "./frame.ts";

/** How long after its last activity a Cell at rest still counts as at work here. */
export const LIVE_FOR_MS = 2 * 60 * 60_000;

/** Other Cells named before "and N more". */
const NAMED = 8;

/** A thread as the roster reads it. */
export interface RosterThread {
  readonly id: string;
  readonly title: string;
  readonly branch: string | null;
  readonly status: string;
  readonly providerInstanceId: string;
  readonly parentThreadId: string | null;
  readonly relationshipToParent: "fork" | "subagent" | null;
  /** Its last activity, in epoch milliseconds. */
  readonly at: number;
}

export interface Roster {
  readonly self: RosterThread;
  /** The others at work, most recent first, at most `NAMED`. */
  readonly others: ReadonlyArray<RosterThread>;
  readonly more: number;
}

const UNDER_WAY = new Set(["preparing", "queued", "starting", "running", "waiting"]);

const isAski = (thread: RosterThread) =>
  thread.providerInstanceId === ASKI_INSTANCE_ID && thread.parentThreadId === null;

const nameOf = (thread: RosterThread) => (isAski(thread) ? "Aski" : cellNameOf(thread.id));

/**
 * The roster `self` reads, from the threads of its repository: every other
 * Cell (a Subcell is its Cell's work) under way, or active within
 * `LIVE_FOR_MS`.
 */
export function rosterOf(
  self: RosterThread,
  threads: ReadonlyArray<RosterThread>,
  now: number,
): Roster {
  const live = threads
    .filter(
      (thread) =>
        thread.id !== self.id &&
        thread.relationshipToParent !== "subagent" &&
        (UNDER_WAY.has(thread.status) || now - thread.at <= LIVE_FOR_MS),
    )
    .toSorted((a, b) => b.at - a.at);
  return { self, others: live.slice(0, NAMED), more: Math.max(0, live.length - NAMED) };
}

/**
 * What makes a roster news: who is named, their one-liners and branches.
 * A state alone changes every turn, and is not.
 */
export function signatureOf(roster: Roster): string {
  return [roster.self, ...roster.others]
    .map((thread) => `${thread.id}\t${thread.title}\t${thread.branch ?? ""}`)
    .concat(String(roster.more))
    .join("\n");
}

const stateOf = (status: string) =>
  status === "waiting"
    ? "waiting on its person"
    : status === "queued"
      ? "queued"
      : UNDER_WAY.has(status)
        ? "working"
        : "at rest";

function line(thread: RosterThread): string {
  const title = isAski(thread) ? "" : `, “${titleOf(thread.title)}”`;
  const branch = thread.branch === null ? "" : `, branch ${titleOf(thread.branch)}`;
  return `- ${nameOf(thread)}${title} (thread ${thread.id}${branch}): ${stateOf(thread.status)}`;
}

/** The note: who this Cell is, then the others, one line each. */
export function rosterText(roster: Roster): string {
  const { self } = roster;
  const you = isAski(self)
    ? `you are Aski (thread ${self.id})`
    : `you are ${nameOf(self)}, the Cell “${titleOf(self.title)}” (thread ${self.id})`;
  const head = `Stemcells, telling you, not the person: ${you}.`;
  if (roster.others.length === 0) return `${head}\nNo other Cell is at work in this repository.`;
  return [
    head,
    "Other Cells at work in this repository:",
    ...roster.others.map(line),
    ...(roster.more === 0 ? [] : [`- and ${roster.more} more (t3_thread_list)`]),
    "Write to one with t3_thread_send only when it changes what it will do.",
  ].join("\n");
}
