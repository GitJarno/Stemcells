/**
 * The plans made from messages to Aski, over its composer (stemcells/tasks/aski-orchestrator.md,
 * decision 4): each stands there from the moment its message goes until its Cells fly and can no
 * longer be called back. A plan Aski's chat proposed stands in the reply instead (`PlanFence.tsx`).
 */
import { useSyncExternalStore } from "react";

import type { CellRef } from "../../tabs/layout";
import { PlanCard } from "./PlanCard";
import { chatKeyOf } from "./room";
import { readPlans, subscribePlans } from "./store";

export function PlanTray(props: { aski: CellRef }) {
  const plans = useSyncExternalStore(subscribePlans, readPlans, readPlans);
  const chat = chatKeyOf(props.aski);
  const here = plans.filter((plan) => plan.chat === chat && plan.source === "message");
  if (here.length === 0) return null;
  return (
    <div data-aski-plan-tray="">
      {here.map((plan) => (
        <PlanCard key={plan.id} live={plan} />
      ))}
    </div>
  );
}
