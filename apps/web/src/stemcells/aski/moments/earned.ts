// The moment earned and not yet played. The watch that earns moments is
// up as long as the workspace is; the theater that plays them only while
// Aski's page is mounted, so what is earned waits here for it to look.

import type { MomentArgs, MomentId } from "./cards.ts";

/** A moment earned: which, what it says, when what earned it happened, its numbers, and what it plays once for, if it does. */
export interface Earned {
  readonly id: MomentId;
  readonly line: string;
  readonly at: number;
  readonly args?: MomentArgs | undefined;
  readonly once?: string | undefined;
}

let waiting: Earned | null = null;
const theaters = new Set<(earned: Earned) => void>();

/** Earns a moment. One not yet played gives way to it. */
export function earn(earned: Earned): void {
  waiting = earned;
  for (const hear of theaters) hear(earned);
}

/** The moment earned and not yet played, if any. */
export const earnedMoment = (): Earned | null => waiting;

/** Takes the moment earned to play it, or to drop it. */
export function takeEarned(): Earned | null {
  const earned = waiting;
  waiting = null;
  return earned;
}

/** Tells `hear` of each moment earned from now on; the returned function stops it. */
export function onEarned(hear: (earned: Earned) => void): () => void {
  theaters.add(hear);
  return () => theaters.delete(hear);
}
