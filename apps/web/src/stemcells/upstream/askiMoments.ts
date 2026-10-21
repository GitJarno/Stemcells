/**
 * What Aski's moments read from upstream besides what its eyes read: how
 * each chat's latest run ended, and when. `askiMoments.contract.test.ts`
 * pins what they rely on.
 */
import { useThreadShells } from "../../state/entities";

/** A run that ended without finishing its work. */
export interface RunDropped {
  /** When it ended, Unix milliseconds. */
  readonly at: number;
}

/**
 * Ended without finishing: failed, or interrupted. The person can interrupt
 * a run too, but not while the page can't reach the server, so one that
 * ends in a silence was lost.
 */
const DROPPED: ReadonlySet<string> = new Set(["failed", "interrupted"]);

/** Every chat's latest run that ended without finishing its work, archived chats aside. */
export function useRunsDropped(): ReadonlyArray<RunDropped> {
  const shells = useThreadShells();
  return shells.flatMap((chat) => {
    const run = chat.latestRun;
    if (chat.archivedAt !== null || run === null || !DROPPED.has(run.status)) return [];
    const at = Date.parse(run.completedAt ?? chat.updatedAt);
    return Number.isNaN(at) ? [] : [{ at }];
  });
}
