/**
 * Every Cell's stage, the same in Aski's roster, on its tab and in its chat
 * (stemcells/tasks/aski-manager.md, decision 7): at work, needs you, or
 * done. Facts first: what needs the person is the list's own cards, and a
 * run under way is at work. Only a Cell whose turn ended is read for its
 * own word (`closeOut.ts`), and done is what's left when nothing holds it.
 * Pure: the service hands it the shells, the cards and the stops it read.
 */
import * as DateTime from "effect/DateTime";

import type { Shell } from "../upstream/needs.ts";
import type { Stop } from "./closeOut.ts";
import {
  ACTIVE_RUN,
  askiThreadOf,
  carriesOn,
  isSnoozed,
  waitsOnItsOwn,
  type Need,
} from "./derive.ts";

export type Stage = "working" | "needs-you" | "done";

export interface CellStanding {
  readonly threadId: string;
  readonly projectId: string;
  /** Its chat's title: what it is on. */
  readonly title: string;
  readonly stage: Stage;
  /** Its own word: what it delivered when done, or what it waits on while at work. */
  readonly line: string | null;
  /** When it was made: the roster lists the newest first and never reorders. */
  readonly createdAt: string;
}

/**
 * The stage of each Cell in reach. A settled, snoozed, archived or deleted
 * Cell has none, nor one that never ran, nor Aski's own chat. A subagent
 * shows through its parent: its card makes the parent need you.
 */
export function standingsOf(
  shells: ReadonlyArray<Shell>,
  needs: ReadonlyArray<Need>,
  stops: ReadonlyMap<string, Stop>,
  now: number,
): ReadonlyArray<CellStanding> {
  const aski = askiThreadOf(shells);
  const needsYou = new Set(needs.flatMap((need) => [need.parentThreadId ?? need.threadId]));
  const standings = shells.flatMap((shell): CellStanding[] => {
    if (shell.deletedAt !== null || shell.archivedAt !== null || shell.settledAt !== null)
      return [];
    if (shell.id === aski || shell.lineage.rootThreadId === aski) return [];
    if (shell.lineage.parentThreadId !== null) return [];
    if (shell.latestRunId === null && shell.activeRunId === null) return [];
    if (isSnoozed(shell, now)) return [];
    const stop = stops.get(shell.id) ?? null;
    const atWork =
      ACTIVE_RUN.has(shell.status) ||
      shell.activeRunId !== null ||
      waitsOnItsOwn(shell) ||
      carriesOn(shell, now) ||
      stop?.waits === true;
    const stage: Stage = needsYou.has(shell.id) ? "needs-you" : atWork ? "working" : "done";
    return [
      {
        threadId: shell.id,
        projectId: shell.projectId,
        title: shell.title,
        stage,
        line: stage === "needs-you" || stop === null ? null : stop.line,
        createdAt: DateTime.formatIso(shell.createdAt),
      },
    ];
  });
  return standings.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
