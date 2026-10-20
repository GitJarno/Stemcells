/**
 * A Cell's face from its chat's status: crashed when its run failed, needs
 * you while it asks (an approval, an answer, a plan to accept), pleased once
 * it has landed and you haven't looked, else awake.
 */
import type { Activity } from "../cell/activity";
import type { Mood } from "../cell/look";
import type { CellStatus } from "../upstream/status";

const MOOD_BY_STATUS: Readonly<Record<CellStatus, Mood>> = {
  "Pending Approval": "needsYou",
  "Awaiting Input": "needsYou",
  "Plan Ready": "needsYou",
  Failed: "crashed",
  Working: "awake",
  Connecting: "awake",
  Waiting: "awake",
  Completed: "pleased",
};

export function moodOfStatus(status: CellStatus | null): Mood {
  return status === null ? "awake" : MOOD_BY_STATUS[status];
}

/**
 * What the status alone says the Cell is doing: waiting on another chat or
 * its background work. What a working Cell is doing needs its tool calls.
 */
export function activityOfStatus(status: CellStatus | null): Activity | undefined {
  return status === "Waiting" ? "waiting" : undefined;
}
