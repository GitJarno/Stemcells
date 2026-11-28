// The plans made in each of Aski's chats, as the chat's machine keeps them
// (stemcells/tasks/aski-orchestrator.md, decision 15): which message each was made from, for
// the card under it. What came of each goes to the phone's one store (`trays.ts`), so a card
// under a message is the same live plan the tray held. No timer starts here.

import {
  type KeptPlan,
  PLANS_PATH,
  type PlansReply,
} from "../../../../../../stemcells/orchestrator/wire.ts";
import type { AskMachine } from "./fence";
import { toldOver, type Trays } from "./trays";

const NONE: ReadonlyArray<KeptPlan> = [];
const keyOf = (environmentId: string, threadId: string) => `${environmentId}\u0000${threadId}`;
/** What a card's place depends on: a list that says the same is the same list. */
const says = (plans: ReadonlyArray<KeptPlan>) =>
  plans.map((plan) => `${plan.id} ${plan.messageId ?? ""}`).join("\n");

export function makeKept(trays: Trays, ask: AskMachine, onPlan: () => void) {
  /** Each chat's plans as its machine last listed them. */
  const listed = new Map<string, ReadonlyArray<KeptPlan>>();
  /** Plans made here, known before any list has them. */
  const local = new Map<string, ReadonlyArray<KeptPlan>>();
  let lists: ReadonlyMap<string, ReadonlyArray<KeptPlan>> = new Map();
  const reading = new Map<string, Promise<boolean>>();
  const listeners = new Set<() => void>();

  const publish = (key: string) => {
    const server = listed.get(key) ?? NONE;
    const known = new Set(server.map((plan) => plan.id));
    const next = [...(local.get(key) ?? NONE).filter((plan) => !known.has(plan.id)), ...server];
    if (says(next) === says(lists.get(key) ?? NONE)) return;
    lists = new Map(lists).set(key, next);
    for (const listener of listeners) listener();
  };

  const read = async (environmentId: string, threadId: string): Promise<boolean> => {
    let answer: Response | null;
    try {
      answer = await ask(environmentId, `${PLANS_PATH}?thread=${encodeURIComponent(threadId)}`);
    } catch {
      return false;
    }
    if (answer === null || !answer.ok) return false;
    const body = (await answer.json().catch(() => null)) as Partial<PlansReply> | null;
    if (!Array.isArray(body?.plans)) return false;
    const holds = (id: string) => (trays.read().get(id)?.tray ?? null) !== null;
    // Another device is still carrying out a plan nothing was told of: its card waits for that.
    const plans = body.plans.filter((plan) => plan.outcome !== null || holds(plan.id));
    if (plans.length > 0) onPlan();
    for (const plan of plans) {
      if (holds(plan.id)) trays.change(plan.id, (tray) => toldOver(tray, plan.outcome));
      else trays.opened(plan.id, environmentId, plan.plan, plan.outcome, threadId);
    }
    const key = keyOf(environmentId, threadId);
    listed.set(key, plans);
    publish(key);
    return true;
  };

  return {
    /** Reads a chat's plans from its machine, or joins the read under way; whether it answered. */
    read: (environmentId: string, threadId: string): Promise<boolean> => {
      const key = keyOf(environmentId, threadId);
      const running = reading.get(key);
      if (running !== undefined) return running;
      const next = read(environmentId, threadId).finally(() => reading.delete(key));
      reading.set(key, next);
      return next;
    },
    /** A plan this phone just made in the chat. */
    made: (environmentId: string, threadId: string, plan: KeptPlan): void => {
      const key = keyOf(environmentId, threadId);
      local.set(key, [plan, ...(local.get(key) ?? NONE).filter((one) => one.id !== plan.id)]);
      publish(key);
    },
    /** A chat's plans, newest first; the same list until what it says changes. */
    of: (environmentId: string, threadId: string): ReadonlyArray<KeptPlan> =>
      lists.get(keyOf(environmentId, threadId)) ?? NONE,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
