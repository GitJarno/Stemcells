/**
 * Carries this window's plans out while the app stands (`run.ts`): mounted once with the
 * workspace, so a plan goes on whatever tab is in front. It holds the hands (the person's own
 * commands) and gives them to the runner fresh on every render.
 */
import { useEffect, useSyncExternalStore } from "react";

import { awakeInSight } from "../../rail/arrivals";
import type { CellRef } from "../../tabs/layout";
import { tellOutcome, useListedCells, usePlanHands } from "../../upstream/askiPlans";
import { toastManager } from "../../upstream/ui";
import { opensNoTab } from "../../windows/landing";
import { throwTo } from "../throw";
import { createRunner, type RunnerHands } from "./run";
import { readPlans, subscribePlans } from "./store";

let hands: RunnerHands | null = null;
const NO_CELLS: readonly string[] = [];

/** The window's runner: what a plan's card calls. */
export const runner = createRunner(() => hands);

/** Aski, where it stands on its composer: a Cell it starts is thrown from there. */
const askiFigure = () => document.querySelector("[data-stemcells-aski] [data-aski-perch-stage]");

/** The threads of the Cells the server is to start, as one word: the same until that set changes. */
const queuedThreads = () =>
  readPlans()
    .flatMap((plan) =>
      (plan.tray?.acts ?? []).flatMap((one) =>
        one.status === "queued" && one.act.kind === "start" ? [one.act.threadId] : [],
      ),
    )
    .join(" ");

export function PlanRunner(props: { aski: CellRef | null }) {
  const own = usePlanHands(props.aski);
  const queued = useSyncExternalStore(subscribePlans, queuedThreads, queuedThreads);
  // Read so this renders, and the runner looks again, when the server starts one of them.
  useListedCells(queued === "" ? NO_CELLS : queued.split(" "));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Hand the runner, which lives outside React, the commands as this render holds them.
  useEffect(() => {
    hands = {
      ...own,
      tell: (outcome) => void tellOutcome(outcome),
      tabless: opensNoTab,
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
