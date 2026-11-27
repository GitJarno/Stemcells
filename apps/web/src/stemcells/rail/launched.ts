/**
 * Cells an agent starts through the tools (`t3_thread_launch`) form in Awake as Aski's planned
 * rows do (`arrivals.ts`): each is a plan of one row, made from its chat as it arrives, so its
 * Cell comes to life in the list before the machine lists it. Aski's room throws a copy to it
 * (`aski/AskiPane.tsx`).
 */
import { useEffect } from "react";

import { clearPlannedRows, setPlannedRows } from "../../../../../stemcells/aski/planned.ts";
import { launchFactsOf, subscribeLaunches } from "../upstream/landing";

// A dev build's hands on the planned rows (`planLab.ts`), loaded with the column. Here, not in a
// component: React Compiler leaves a function with an `import()` unoptimized.
if (import.meta.env.DEV && typeof window !== "undefined") void import("./planLab");

/** The plan a launched Cell's row belongs to. */
const launchPlanOf = (threadId: string) => `launch:${threadId}`;
/** A launch's plan is over once its row has said its birth and gone (`ARRIVALS.linger`), with room to spare, ms. */
const PLAN_ENDS = 90_000;

/** While the column shows: each chat an agent launches on `environmentId` arrives in Awake as a planned row. */
export function useLaunchesArrive(environmentId: string | null): void {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Subscribe to launched chats while the column shows this machine, and unsubscribe when it doesn't.
  useEffect(() => {
    if (environmentId === null) return;
    const ending = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = subscribeLaunches((cells) => {
      for (const cell of cells) {
        const facts = cell.environmentId === environmentId ? launchFactsOf(cell) : null;
        if (facts === null) continue;
        const planId = launchPlanOf(cell.threadId);
        setPlannedRows(planId, [{ ...facts, threadId: cell.threadId, tier: "start" }]);
        const timer = setTimeout(() => {
          ending.delete(timer);
          clearPlannedRows(planId);
        }, PLAN_ENDS);
        ending.add(timer);
      }
    });
    return () => {
      unsubscribe();
      for (const timer of ending) clearTimeout(timer);
    };
  }, [environmentId]);
}
