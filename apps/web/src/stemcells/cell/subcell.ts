// A Subcell, the subagent a Cell starts for part of its work, is drawn as a Cell of its own
// (`SubcellMark`), its face from the status upstream gives the subagent, as a Cell's comes
// from its chat's (`tabs/cellMood.ts`): it thinks while it works, waits while it waits, wears
// the crash when its run failed, and stands awake otherwise.

import type { Activity } from "./activity.ts";
import type { Mood } from "./look.ts";

/** A subagent's status as upstream names it; one it adds later stands awake. */
export type SubcellStatus =
  | "pending"
  | "running"
  | "waiting"
  | "idle"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export function subcellFace(status: string | undefined): {
  readonly mood: Mood;
  readonly activity: Activity | undefined;
} {
  switch (status) {
    case "pending":
    case "running":
      return { mood: "awake", activity: "thinking" };
    case "waiting":
      return { mood: "awake", activity: "waiting" };
    case "failed":
      return { mood: "crashed", activity: undefined };
    default:
      return { mood: "awake", activity: undefined };
  }
}
