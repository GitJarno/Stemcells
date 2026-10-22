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

/** A Cell at work on a linked environment, as that environment told it. */
export interface ElsewhereThread {
  /** Its environment's name here. */
  readonly environment: string;
  readonly id: string;
  readonly title: string;
  readonly branch: string | null;
  readonly status: string;
  readonly aski: boolean;
  readonly at: number;
}

export interface Roster {
  readonly self: RosterThread;
  /** The others at work, most recent first, at most `NAMED`. */
  readonly others: ReadonlyArray<RosterThread>;
  readonly more: number;
  /** Those at work on linked environments, most recent first, at most `NAMED`. */
  readonly elsewhere: ReadonlyArray<ElsewhereThread>;
  readonly elsewhereMore: number;
}

const UNDER_WAY = new Set(["preparing", "queued", "starting", "running", "waiting"]);

export const isAski = (thread: RosterThread) =>
  thread.providerInstanceId === ASKI_INSTANCE_ID && thread.parentThreadId === null;

const nameOf = (thread: RosterThread) => (isAski(thread) ? "Aski" : cellNameOf(thread.id));

/** A Cell (a Subcell is its Cell's work) under way, or active within `LIVE_FOR_MS`. */
export const isAtWork = (thread: RosterThread, now: number) =>
  thread.relationshipToParent !== "subagent" &&
  (UNDER_WAY.has(thread.status) || now - thread.at <= LIVE_FOR_MS);

/**
 * The roster `self` reads, from the threads of its repository, here and on
 * linked environments: every other Cell at work.
 */
export function rosterOf(
  self: RosterThread,
  threads: ReadonlyArray<RosterThread>,
  now: number,
  elsewhere: ReadonlyArray<ElsewhereThread> = [],
): Roster {
  const live = threads
    .filter((thread) => thread.id !== self.id && isAtWork(thread, now))
    .toSorted((a, b) => b.at - a.at);
  const there = elsewhere.toSorted((a, b) => b.at - a.at);
  return {
    self,
    others: live.slice(0, NAMED),
    more: Math.max(0, live.length - NAMED),
    elsewhere: there.slice(0, NAMED),
    elsewhereMore: Math.max(0, there.length - NAMED),
  };
}

/**
 * What makes a roster news: who is named, their one-liners and branches.
 * A state alone changes every turn, and is not.
 */
export function signatureOf(roster: Roster): string {
  return [roster.self, ...roster.others]
    .map((thread) => `${thread.id}\t${thread.title}\t${thread.branch ?? ""}`)
    .concat(String(roster.more))
    .concat(
      roster.elsewhere.map(
        (thread) => `${thread.environment}\t${thread.id}\t${thread.title}\t${thread.branch ?? ""}`,
      ),
    )
    .concat(String(roster.elsewhereMore))
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

function lineElsewhere(thread: ElsewhereThread): string {
  const name = thread.aski ? "Aski" : cellNameOf(thread.id);
  const title = thread.aski || thread.title === "" ? "" : `, “${titleOf(thread.title)}”`;
  const branch = thread.branch === null ? "" : `, branch ${titleOf(thread.branch)}`;
  return `- ${name} on ${titleOf(thread.environment)}${title} (thread ${thread.id}${branch}): ${stateOf(thread.status)}`;
}

/** The note: who this Cell is, then the others here and elsewhere, one line each. */
export function rosterText(roster: Roster): string {
  const { self } = roster;
  const you = isAski(self)
    ? `you are Aski (thread ${self.id})`
    : `you are ${nameOf(self)}, the Cell “${titleOf(self.title)}” (thread ${self.id})`;
  const head = `Stemcells, telling you, not the person: ${you}.`;
  const here = roster.others.length > 0;
  const there = roster.elsewhere.length > 0;
  if (!here && !there) return `${head}\nNo other Cell is at work in this repository.`;
  const how =
    here && there
      ? "Write to one here with t3_thread_send, and to one on another machine with stemcells_peer_send, only when it changes what it will do."
      : `Write to one with ${here ? "t3_thread_send" : "stemcells_peer_send"} only when it changes what it will do.`;
  return [
    head,
    ...(here
      ? [
          "Other Cells at work in this repository:",
          ...roster.others.map(line),
          ...(roster.more === 0 ? [] : [`- and ${roster.more} more (t3_thread_list)`]),
        ]
      : []),
    ...(there
      ? [
          "On other machines, in this repository:",
          ...roster.elsewhere.map(lineElsewhere),
          ...(roster.elsewhereMore === 0 ? [] : [`- and ${roster.elsewhereMore} more`]),
        ]
      : []),
    how,
  ].join("\n");
}
