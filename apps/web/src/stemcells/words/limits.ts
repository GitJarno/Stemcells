/**
 * A readout note for each provider the Cells would start on whose plan runs short (decision 10):
 * "Claude Code Weekly: 6% left". It only warns: the Cells start where the words say and never
 * move to another account by themselves. Short is a tenth or less left (`plans.ts`); spending
 * ahead of pace alone stays off the readout.
 */
import { bindingPlan, type PlanTone, planTone } from "./plans";
import { formatDuration, type LimitPool, providerLook } from "../upstream/rail";

export interface LimitNote {
  readonly text: string;
  readonly tone: Exclude<PlanTone, "fine">;
}

/** `drivers`: the providers the Cells start on, as their drivers; `now` in epoch ms. */
export function limitNotes(
  drivers: Iterable<string>,
  pools: ReadonlyArray<LimitPool>,
  now: number,
): LimitNote[] {
  const notes: LimitNote[] = [];
  for (const driver of new Set(drivers)) {
    const plan = bindingPlan(pools.filter((pool) => pool.driver === driver));
    if (plan === null) continue;
    const tone = planTone({ remainingPercent: plan.left, pace: null });
    if (tone === "fine") continue;
    const resets =
      tone === "out" && plan.resetsAt !== null && plan.resetsAt > now
        ? ` · resets in ${formatDuration(plan.resetsAt - now)}`
        : "";
    notes.push({
      text: `${providerLook(plan.driver).name} ${plan.label}: ${plan.left}% left${resets}`,
      tone,
    });
  }
  return notes;
}
