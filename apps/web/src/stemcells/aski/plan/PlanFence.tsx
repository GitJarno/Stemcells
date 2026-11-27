/**
 * A plan Aski's chat proposed, where its reply shows it (stemcells/tasks/aski-orchestrator.md,
 * decision 8): a `plan` fence names the plan, this reads it from the server and draws its card.
 * Every Cell of it waits for the person's tap: Aski's chat can propose, never start.
 */
import { use, useEffect, useState, useSyncExternalStore } from "react";

import { trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
import { readPlan } from "../../upstream/askiPlans";
import { PlanCard } from "./PlanCard";
import { chatKeyOf, PlanRoom } from "./room";
import { adoptPlan, readPlans, subscribePlans } from "./store";

export function PlanFence(props: { id: string }) {
  const aski = use(PlanRoom);
  const plans = useSyncExternalStore(subscribePlans, readPlans, readPlans);
  const live = plans.find((plan) => plan.id === props.id) ?? null;
  const [gone, setGone] = useState(false);
  const chat = aski === null ? null : chatKeyOf(aski);
  const known = live !== null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Read the proposed plan from the server once, when its fence first shows in Aski's chat.
  useEffect(() => {
    if (known || chat === null) return;
    let stopped = false;
    void readPlan(props.id).then((read) => {
      if (stopped) return;
      if (read === null) return setGone(true);
      const told = new Map((read.outcome ?? []).map((act) => [act.i, act]));
      const tray = trayOf(read.plan);
      // What another window, or this one before a reload, already did with it stands.
      adoptPlan(
        chat,
        {
          ...tray,
          acts: tray.acts.map((one) => {
            const was = told.get(one.act.i);
            return was === undefined || was.status === "waiting"
              ? { ...one, status: "waiting" as const }
              : { ...one, status: was.status, ...(was.reason ? { reason: was.reason } : {}) };
          }),
        },
        Date.now(),
      );
    });
    return () => {
      stopped = true;
    };
  }, [known, chat, props.id]);
  if (live !== null) return <PlanCard live={live} />;
  // Outside Aski's chat, or a plan the server no longer keeps: the fence says so in a line.
  return (
    <p data-plan-note="">
      {gone || aski === null ? "This plan is no longer kept." : "Aski's plan…"}
    </p>
  );
}
