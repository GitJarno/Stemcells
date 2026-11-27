/**
 * Carries this window's plans out while the app stands (`run.ts`): mounted once with the
 * workspace, so a plan goes on whatever tab is in front. It holds the hands (the person's own
 * commands) and gives them to the runner fresh on every render.
 */
import { useEffect } from "react";

import { awakeInSight } from "../../rail/arrivals";
import type { CellRef } from "../../tabs/layout";
import { tellOutcome, usePlanHands } from "../../upstream/askiPlans";
import { toastManager } from "../../upstream/ui";
import { opensNoTab } from "../../windows/landing";
import { throwTo } from "../throw";
import { createRunner, type RunnerHands } from "./run";
import { subscribePlans } from "./store";

let hands: RunnerHands | null = null;

/** The window's runner: what a plan's card calls. */
export const runner = createRunner(() => hands);

/** Aski, where it stands on its composer: a Cell it starts is thrown from there. */
const askiFigure = () =>
  document.querySelector("[data-stemcells-aski] [data-aski-perch-stage]");

export function PlanRunner(props: { aski: CellRef | null }) {
  const own = usePlanHands(props.aski);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the runner, which lives outside React, the commands as this render holds them.
  useEffect(() => {
    hands = {
      ...own,
      tell: (outcome) => void tellOutcome(outcome),
      arrive: (threadIds) => {
        opensNoTab(threadIds);
        const figure = askiFigure();
        if (figure && awakeInSight()) throwTo(threadIds, figure);
      },
      report: (title, description) => toastManager.add({ type: "error", title, description }),
    };
    runner.sync();
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Follow the plan store, which lives outside React, and let go of the hands on unmount.
  useEffect(() => {
    const stop = subscribePlans(runner.sync);
    return () => {
      stop();
      hands = null;
    };
  }, []);
  return null;
}
