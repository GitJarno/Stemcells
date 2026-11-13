// Which Cells the collection speaks of on one machine: the ones the person may dress, and
// whether any of them waits on the person (a feat's card waits then). Pure, over the chats as
// T3 holds them.

import { askiChatsOf } from "../aski/chat";
import { inTab } from "../home/tabs";
import type { EnvironmentThreadShell } from "../upstream/threads";
import { MOST_TO_DRESS } from "./kit";

type CrewShell = Parameters<typeof askiChatsOf>[0][number] &
  Pick<EnvironmentThreadShell, "archivedAt" | "updatedAt">;

/**
 * The Cells of `environmentId` the person may dress: its chats that aren't archived, a Subcell's
 * or Aski's, the twelve most recently active, the most recent first.
 */
export function cellsToDress<Shell extends CrewShell>(
  threads: ReadonlyArray<Shell>,
  environmentId: string,
): Shell[] {
  const aski = askiChatsOf(threads);
  return threads
    .filter(
      (thread) =>
        thread.environmentId === environmentId &&
        thread.archivedAt === null &&
        thread.deletedAt === null &&
        thread.lineage.relationshipToParent !== "subagent" &&
        !aski.has(thread.id),
    )
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, MOST_TO_DRESS);
}

type WaitingShell = Parameters<typeof inTab>[0] &
  Pick<EnvironmentThreadShell, "environmentId" | "archivedAt">;

/** Whether a Cell of `environmentId` waits on the person at `now` (an ISO time): its stage is Input. */
export function waitsOnPerson(
  threads: ReadonlyArray<WaitingShell>,
  environmentId: string,
  now: string,
): boolean {
  return threads.some(
    (thread) =>
      thread.environmentId === environmentId &&
      thread.archivedAt === null &&
      inTab(thread, "input", now),
  );
}
