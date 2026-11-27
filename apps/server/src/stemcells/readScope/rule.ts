/**
 * Which chats a Cell's tools reach (stemcells/tasks/aski-orchestrator.md, decision 10): its
 * own repository's, as the roster groups them, so nothing from one project bleeds into a
 * Cell at work in another. Aski's chat reaches every chat, as the person does. Pure: the
 * adapter (`upstream/readScope.ts`) reads the threads and asks here.
 */
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";

export interface ScopeThread {
  readonly id: string;
  readonly projectId: string;
  /** Its project's repository, by upstream's grouping key; null when the project has none. */
  readonly repo: string | null;
  readonly providerInstanceId: string;
  readonly parentThreadId: string | null;
  /** The chat its family grew from: itself, or the Cell a Subcell or a fork descends from. */
  readonly rootThreadId: string;
}

/** What only the chats' messages tell, read when nothing nearer gives a reach. */
export interface Ties {
  /** The Cell, or the Cell it is a Subcell of, started the chat with its first message. */
  readonly launched: boolean;
  /** The person attached the chat in one of their own messages to the Cell. */
  readonly attached: boolean;
}

export const NO_TIES: Ties = { launched: false, attached: false };

export type Reach = "aski" | "self" | "family" | "repository" | "launched" | "attached";

/** Aski's own chat. A Subcell of Aski is a Cell like any other. */
export const isAskisChat = (thread: Pick<ScopeThread, "providerInstanceId" | "parentThreadId">) =>
  thread.providerInstanceId === ASKI_INSTANCE_ID && thread.parentThreadId === null;

/** A project with no repository is only itself. */
export const sameRepository = (
  one: Pick<ScopeThread, "projectId" | "repo">,
  other: Pick<ScopeThread, "projectId" | "repo">,
) => one.projectId === other.projectId || (one.repo !== null && one.repo === other.repo);

/** How `caller` reaches `target`, or null when it doesn't. */
export function reachOf(caller: ScopeThread, target: ScopeThread, ties: Ties): Reach | null {
  if (isAskisChat(caller)) return "aski";
  if (caller.id === target.id) return "self";
  // A Subcell, its Cell and that Cell's other Subcells and forks are one family.
  if (caller.rootThreadId === target.rootThreadId) return "family";
  if (sameRepository(caller, target)) return "repository";
  if (ties.launched) return "launched";
  return ties.attached ? "attached" : null;
}

/** The tools that only read a chat. Every other tool that names one writes to it or changes it. */
const READS = new Set(["t3_thread_read", "t3_thread_wait"]);

/** An attached chat is reference material: read, never written to. */
export const allows = (tool: string, reach: Reach | null) =>
  reach !== null && (reach !== "attached" || READS.has(tool));

/** What a refused Cell reads. A model acts on these, so each says what it can do instead. */
export const refusalOf = (tool: string) =>
  READS.has(tool)
    ? "That chat is in another repository. A Cell reads its own repository's chats; the person can attach it."
    : "That chat is in another repository. A Cell writes to and changes only its own repository's chats. Tell the person what you wanted it to know.";

export const OTHER_PROJECT =
  "That project is another repository. A Cell lists and searches its own repository's chats; the person can attach one from elsewhere.";
