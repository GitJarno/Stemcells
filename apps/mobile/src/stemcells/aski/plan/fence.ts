// A ```plan fence's plan, read from its chat's machine once however many views show the fence
// (stemcells/tasks/aski-orchestrator.md, decision 1): the plan with what already came of it, or
// word that the server has forgotten it.

import type { Plan } from "../../../../../../stemcells/orchestrator/plan.ts";
import { PLAN_PATH } from "../../../../../../stemcells/orchestrator/wire.ts";
import type { ToldOutcome, Trays } from "./trays";

export type Found = "plan" | "gone" | "unreachable";

/** Asks a machine's own server; null while there is no direct line to it. */
export type AskMachine = (environmentId: string, path: string) => Promise<Response | null>;

export function fenceReader(trays: Trays, ask: AskMachine, onPlan: () => void) {
  const opening = new Map<string, Promise<Found>>();
  const read = async (environmentId: string, id: string): Promise<Found> => {
    let answer: Response | null;
    try {
      answer = await ask(environmentId, `${PLAN_PATH}?id=${encodeURIComponent(id)}`);
    } catch {
      return "unreachable";
    }
    if (answer === null) return "unreachable";
    if (answer.status === 404) {
      trays.gone(id, environmentId);
      return "gone";
    }
    if (!answer.ok) return "unreachable";
    const body = (await answer.json().catch(() => null)) as {
      readonly plan?: Plan;
      readonly outcome?: ReadonlyArray<ToldOutcome> | null;
    } | null;
    if (body?.plan === undefined) return "unreachable";
    onPlan();
    trays.opened(id, environmentId, body.plan, body.outcome ?? null);
    return "plan";
  };
  /** Reads the plan into the store unless it is there; what was found. */
  return (environmentId: string, id: string): Promise<Found> => {
    const held = trays.read().get(id);
    if (held !== undefined) return Promise.resolve(held.state === "gone" ? "gone" : "plan");
    const key = `${environmentId}\u0000${id}`;
    const running = opening.get(key);
    if (running !== undefined) return running;
    const reading = read(environmentId, id).finally(() => opening.delete(key));
    opening.set(key, reading);
    return reading;
  };
}
