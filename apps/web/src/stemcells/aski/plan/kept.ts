/**
 * The plans the server keeps for Aski's chats (stemcells/tasks/aski-orchestrator.md, decision
 * 15), as this window last read them (`keptRead.ts`): a plan stands under its message after any
 * reload, and a queued Cell the server started, dropped or couldn't start is learnt from here.
 */
import { showsUnder } from "../../../../../../stemcells/orchestrator/rows.ts";
import {
  begun,
  drop,
  type Tray,
  trayWith,
  unqueued,
} from "../../../../../../stemcells/orchestrator/tray.ts";
import {
  type KeptPlan,
  PLAN_NOTE_MS,
  planOfMessage,
  planWords,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import { adoptKept, changePlan, type LivePlan, planOf } from "./store";

/** A message in Aski's chat, as a plan is matched to it. */
export interface Said {
  readonly id: string;
  readonly text: string;
  /** When it was sent, in epoch milliseconds. */
  readonly at: number;
}

/**
 * A kept plan as it stands in this window; null for one with nothing to show. Nothing starts
 * because a window read a plan: what no client is known to have carried out waits for a tap.
 */
export function keptTray(kept: KeptPlan): Tray | null {
  if (kept.outcome === null) return null;
  const told = new Set(kept.outcome.flatMap((one) => (one.status === "waiting" ? [] : [one.i])));
  const tray = trayWith(kept.plan, kept.outcome);
  const stands: Tray = {
    ...tray,
    acts: tray.acts.map((one) => (told.has(one.act.i) ? one : { ...one, status: "waiting" })),
  };
  return showsUnder(stands) ? stands : null;
}

/**
 * A plan this window holds, with what the server now says of it. The server's word counts only
 * for a Cell it holds queued: what the person is acting on here stands.
 */
export function withTold(tray: Tray, outcome: KeptPlan["outcome"]): Tray {
  let next = tray;
  for (const told of outcome ?? []) {
    if (next.acts.find((one) => one.act.i === told.i)?.status !== "queued") continue;
    if (told.status === "started") next = begun(next, told.i);
    else if (told.status === "failed")
      next = unqueued(next, told.i, told.reason ?? "The Cell didn't start.");
    else if (told.status === "dropped") next = drop(next, told.i);
  }
  return next;
}

const NONE: ReadonlyArray<KeptPlan> = [];
const lists = new Map<string, ReadonlyArray<KeptPlan>>();
const listeners = new Set<() => void>();

/** The server's plans for `chat`, newest first, as last read. */
export const keptOf = (chat: string): ReadonlyArray<KeptPlan> => lists.get(chat) ?? NONE;

export function subscribeKept(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The server's list for `chat` arrived: plans this window holds hear it, the rest are adopted. */
export function takeKept(chat: string, list: ReadonlyArray<KeptPlan>): void {
  lists.set(chat, list);
  for (const kept of list) changePlan(kept.id, (tray) => withTold(tray, kept.outcome));
  adoptKept(
    chat,
    list.flatMap((kept) => {
      // A plan Aski's chat proposed stands in the reply, where its fence reads it.
      if (planOf(kept.id) !== null || kept.plan.from === "proposed") return [];
      const tray = keptTray(kept);
      return tray === null ? [] : [{ tray, at: kept.at }];
    }),
  );
  for (const listener of listeners) listener();
}

/**
 * The plan `message` was made into: the server's word first, else a plan of this window made
 * from the same words about then, which the server's list may not have yet.
 */
export function planUnder(
  kept: ReadonlyArray<KeptPlan>,
  live: ReadonlyArray<LivePlan>,
  chat: string,
  message: Said,
): string | null {
  const known = planOfMessage(kept, message);
  if (known !== null) return known.id;
  const words = planWords(message.text);
  let found: LivePlan | null = null;
  for (const plan of live) {
    if (plan.chat !== chat || plan.source === "proposed" || plan.words !== words) continue;
    if (plan.words === "" || Math.abs(plan.at - message.at) > PLAN_NOTE_MS) continue;
    if (found === null || plan.at > found.at) found = plan;
  }
  return found?.id ?? null;
}

/** Whether a plan of `chat` holds a Cell the server is to start: its list is read again meanwhile. */
export const holdsQueued = (live: ReadonlyArray<LivePlan>, chat: string): boolean =>
  live.some(
    (plan) =>
      plan.chat === chat && (plan.tray?.acts.some((one) => one.status === "queued") ?? false),
  );

/** For tests. */
export function clearKept(): void {
  lists.clear();
}
