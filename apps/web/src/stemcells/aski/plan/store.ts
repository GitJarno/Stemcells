/**
 * The plans this window holds (stemcells/tasks/aski-orchestrator.md, decisions 4, 5, 7 and 15):
 * one per message to Aski that starts, makes or deletes something, and one per plan Aski's chat
 * proposed. The window that holds a plan carries it out (`PlanRunner.tsx`), with the person's own
 * access; a message's plan ends under its message, where a reload reads it again (`kept.ts`).
 */
import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { showsUnder } from "../../../../../../stemcells/orchestrator/rows.ts";
import { type Tray, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
import { planWords } from "../../../../../../stemcells/orchestrator/wire.ts";

export interface LivePlan {
  readonly id: string;
  /** Aski's chat it belongs to, as `environmentId/threadId`. */
  readonly chat: string;
  readonly at: number;
  /** The server is still reading the message. */
  readonly reading: boolean;
  /** Null while reading, and for a message the server couldn't answer for. */
  readonly tray: Tray | null;
  /**
   * `message`: stands over the composer. `proposed`: stands in Aski's reply, where its fence is.
   * `kept`: stands under the message it was made from.
   */
  readonly source: "message" | "proposed" | "kept";
  /** Its message's words, as a plan is matched to a message; empty for one read from the server. */
  readonly words: string;
  /** The acts the server already held queued when this window read the plan: never handed over again. */
  readonly handed: readonly number[];
}

const queuedIn = (tray: Tray): number[] =>
  tray.acts.flatMap((one) => (one.status === "queued" ? [one.act.i] : []));

let plans: readonly LivePlan[] = [];
const listeners = new Set<() => void>();

function set(next: readonly LivePlan[]): void {
  plans = next;
  for (const listener of listeners) listener();
}

export const readPlans = (): readonly LivePlan[] => plans;
export const planOf = (id: string): LivePlan | null => plans.find((plan) => plan.id === id) ?? null;

export function subscribePlans(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** A message went to Aski and its plan is being read. */
export function beginPlan(id: string, chat: string, at: number, text = ""): void {
  if (planOf(id) !== null) return;
  set([
    ...plans,
    {
      id,
      chat,
      at,
      reading: true,
      tray: null,
      source: "message",
      words: planWords(text),
      handed: [],
    },
  ]);
}

/** The plan came: its Start tier is on its way, the rest waits. A plan of only talk leaves. */
export function planRead(id: string, plan: Plan | null): void {
  const live = planOf(id);
  if (live === null || !live.reading) return;
  if (plan === null || (plan.acts.length === 0 && plan.from !== "floor"))
    return set(plans.filter((one) => one.id !== id));
  set(plans.map((one) => (one.id === id ? { ...one, reading: false, tray: trayOf(plan) } : one)));
}

/** A plan Aski's chat proposed, read from the server: every Cell of it waits. */
export function adoptPlan(chat: string, tray: Tray, at: number): void {
  adopt(chat, [{ tray, at }], "proposed");
}

/** Plans the server keeps for `chat`, each as it stands: they stand under their messages. */
export function adoptKept(
  chat: string,
  kept: ReadonlyArray<{ readonly tray: Tray; readonly at: number }>,
): void {
  adopt(chat, kept, "kept");
}

function adopt(
  chat: string,
  read: ReadonlyArray<{ readonly tray: Tray; readonly at: number }>,
  source: "proposed" | "kept",
): void {
  const fresh = read.filter(({ tray }) => planOf(tray.plan.id) === null);
  if (fresh.length === 0) return;
  set([
    ...plans,
    ...fresh.map(({ tray, at }): LivePlan => ({
      id: tray.plan.id,
      chat,
      at,
      reading: false,
      tray,
      source,
      words: "",
      handed: queuedIn(tray),
    })),
  ]);
}

/** Changes a plan's tray; the same tray back changes nothing. */
export function changePlan(id: string, change: (tray: Tray) => Tray): void {
  const live = planOf(id);
  if (live === null || live.tray === null) return;
  const next = change(live.tray);
  if (next === live.tray) return;
  set(plans.map((one) => (one.id === id ? { ...one, tray: next } : one)));
}

/** The plan leaves the window: its message never went, or the server couldn't answer for it. */
export function closePlan(id: string): void {
  if (planOf(id) !== null) set(plans.filter((one) => one.id !== id));
}

/**
 * A message's plan leaves the composer: it stands under its message from here on, or leaves the
 * window when it has no Cell to show there.
 */
export function leavePlan(id: string): void {
  const live = planOf(id);
  if (live === null || live.source !== "message") return;
  if (live.tray === null || !showsUnder(live.tray)) return closePlan(id);
  set(plans.map((one) => (one.id === id ? { ...one, source: "kept" } : one)));
}

/** For tests. */
export function clearPlans(): void {
  set([]);
}
