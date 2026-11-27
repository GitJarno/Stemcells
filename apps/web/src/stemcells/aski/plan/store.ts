/**
 * The plans this window holds (stemcells/tasks/aski-orchestrator.md, decisions 4, 5 and 7): one
 * per message to Aski that starts, makes or deletes something, and one per plan Aski's chat
 * proposed. A plan is carried out by the window that holds it (`PlanRunner.tsx`), with the
 * person's own access; a reload forgets what still waited, and nothing starts unasked.
 */
import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { type Tray, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";

export interface LivePlan {
  readonly id: string;
  /** Aski's chat it belongs to, as `environmentId/threadId`. */
  readonly chat: string;
  readonly at: number;
  /** The server is still reading the message. */
  readonly reading: boolean;
  /** Null while reading, and for a message the server couldn't answer for. */
  readonly tray: Tray | null;
  /** `message`: stands over the composer. `proposed`: stands in Aski's reply, where its fence is. */
  readonly source: "message" | "proposed";
}

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
export function beginPlan(id: string, chat: string, at: number): void {
  if (planOf(id) !== null) return;
  set([...plans, { id, chat, at, reading: true, tray: null, source: "message" }]);
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
  if (planOf(tray.plan.id) !== null) return;
  set([...plans, { id: tray.plan.id, chat, at, reading: false, tray, source: "proposed" }]);
}

/** Changes a plan's tray; the same tray back changes nothing. */
export function changePlan(id: string, change: (tray: Tray) => Tray): void {
  const live = planOf(id);
  if (live === null || live.tray === null) return;
  const next = change(live.tray);
  if (next === live.tray) return;
  set(plans.map((one) => (one.id === id ? { ...one, tray: next } : one)));
}

/** The plan leaves the window: nothing of it waits or can be called back. */
export function closePlan(id: string): void {
  if (planOf(id) !== null) set(plans.filter((one) => one.id !== id));
}

/** For tests. */
export function clearPlans(): void {
  set([]);
}
