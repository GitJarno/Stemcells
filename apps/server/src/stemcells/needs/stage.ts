/**
 * Every Cell's stage (stemcells/tasks/aski-manager.md, decision 7), the same in Aski's
 * roster, its tab and its chat: at work, needs you, or done. Facts first: needs you is the
 * list's own cards, a run under way is at work, and only a Cell whose turn ended is read for
 * its own word (`closeOut.ts`); done is what's left. Pure.
 */
import * as DateTime from "effect/DateTime";

import { isSnoozed, type Shell } from "../upstream/needs.ts";
import type { Stop } from "./closeOut.ts";
import { heldBy } from "./conditions.ts";
import { ACTIVE_RUN, askiThreadOf, waitsOnItsOwn, type Need } from "./derive.ts";
import type { Brief } from "./evidence.ts";
import { landingOf, type Landing } from "./verdict.ts";

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
  /**
   * When this stage began: its run's start while at work, its run's end once done or held; else
   * null.
   */
  readonly since: string | null;
  /**
   * The condition that holds it, by its key (`conditions.ts`): stopped by a cause it shares,
   * so neither asking nor flying. The stage stays `working` for a reader from before this.
   */
  readonly holds: string | null;
  /** How a done Cell landed, and the fact that says so (`verdict.ts`); null at any other stage. */
  readonly landing: Landing | null;
  /** What it was told and what its last run shows; null while it works unasked, or unread. */
  readonly brief: Brief | null;
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
  briefs: ReadonlyMap<string, Brief> = new Map(),
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
    const holds = heldBy(shell);
    const atWork =
      ACTIVE_RUN.has(shell.status) ||
      shell.activeRunId !== null ||
      waitsOnItsOwn(shell) ||
      holds !== null ||
      stop?.waits === true;
    const stage: Stage = needsYou.has(shell.id) ? "needs-you" : atWork ? "working" : "done";
    const brief = briefs.get(shell.id) ?? null;
    const since =
      stage === "done" || (stage === "working" && holds !== null)
        ? (shell.latestRunCompletedAt ?? null)
        : stage === "working"
          ? (shell.activityRunStartedAt ?? shell.latestRunStartedAt ?? shell.latestRunRequestedAt)
          : null;
    return [
      {
        threadId: shell.id,
        projectId: shell.projectId,
        title: shell.title,
        stage,
        line: stage === "needs-you" || stop === null ? null : stop.line,
        createdAt: DateTime.formatIso(shell.createdAt),
        since: since == null ? null : DateTime.formatIso(since),
        holds: stage === "working" ? holds : null,
        landing: stage === "done" ? landingOf(shell.status, brief) : null,
        brief,
      },
    ];
  });
  return standings.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}
