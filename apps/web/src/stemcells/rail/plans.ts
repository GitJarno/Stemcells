/**
 * The plan limit the rail's ring shows: of every provider's limit windows,
 * the one that binds first. The worse tone wins, then the smaller share
 * left.
 */
import type { LimitPool } from "../upstream/rail";

/** Fine; low (a tenth or less left, or spending faster than the window runs); out. */
export type PlanTone = "fine" | "low" | "out";

type PoolWindow = LimitPool["windows"][number];

export interface PlanReading {
  readonly driver: LimitPool["driver"];
  readonly label: string;
  /** Percent left, 0 to 100. */
  readonly left: number;
  readonly tone: PlanTone;
  /** When the soonest reset comes, as epoch milliseconds; null when unknown. */
  readonly resetsAt: number | null;
}

const SEVERITY: Readonly<Record<PlanTone, number>> = { fine: 0, low: 1, out: 2 };

/**
 * Spending faster than the window elapses ("ahead" of pace) runs it out
 * before it refills, at the rate so far.
 */
export function planTone(window: Pick<PoolWindow, "remainingPercent" | "pace">): PlanTone {
  if (window.remainingPercent <= 0) return "out";
  return window.remainingPercent <= 10 || window.pace === "ahead" ? "low" : "fine";
}

export function bindingPlan(pools: ReadonlyArray<LimitPool>): PlanReading | null {
  let binding: PlanReading | null = null;
  for (const pool of pools) {
    for (const window of pool.windows) {
      const reading: PlanReading = {
        driver: pool.driver,
        label: window.label,
        left: Math.max(0, Math.min(100, window.remainingPercent)),
        tone: planTone(window),
        resetsAt: window.resets.length > 0 ? Math.min(...window.resets.map((r) => r.at)) : null,
      };
      if (
        binding === null ||
        SEVERITY[reading.tone] > SEVERITY[binding.tone] ||
        (reading.tone === binding.tone && reading.left < binding.left)
      ) {
        binding = reading;
      }
    }
  }
  return binding;
}
