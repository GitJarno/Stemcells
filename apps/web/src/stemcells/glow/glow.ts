// What a composer's glass says, from upstream's status: the light's numbers are `light.ts`.
import type { CellStatus } from "../upstream/status";

/**
 * What a composer's glass says about its Cell: plain glass is your turn;
 * working fills it with the provider's colour and sweeps a band across it;
 * needs you tints it warm and breathes, no sweep, because nothing moves
 * until you do.
 */
export type Glow = "quiet" | "working" | "needsYou";

const GLOW_BY_STATUS: Readonly<Record<CellStatus, Glow>> = {
  "Pending Approval": "needsYou",
  "Awaiting Input": "needsYou",
  // A guest's message waits on the person to let it through.
  "Guest Request": "needsYou",
  "Plan Ready": "needsYou",
  // A turn in flight, one on its way, or background work holding it.
  Working: "working",
  Connecting: "working",
  Waiting: "working",
  Failed: "quiet",
  Completed: "quiet",
};

export function glowOf(status: CellStatus | null): Glow {
  return status === null ? "quiet" : GLOW_BY_STATUS[status];
}
