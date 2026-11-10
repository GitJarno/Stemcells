/**
 * A stop one cause puts on many Cells at once: for now a usage limit, which stops every Cell
 * on an account and which no answer to any one of them lifts
 * (stemcells/tasks/conditions.md). One line for the cause, its Cells holding under it. Pure.
 */
import * as DateTime from "effect/DateTime";

import { isSnoozed, type Shell } from "../upstream/needs.ts";
import { askiThreadOf, carriesOn, limitResetAt, runEnded } from "./derive.ts";

export interface HeldCell {
  readonly threadId: string;
  readonly projectId: string;
  readonly title: string;
  /** When its run stopped. */
  readonly since: string;
  /** It carries on at the reset by itself. */
  readonly carriesOn: boolean;
}

export interface Condition {
  /** Its account and its reset: a new window on the same account is a new condition. */
  readonly key: string;
  readonly kind: "limit";
  readonly providerInstanceId: string;
  /** When the limit resets, as the refusal said; null when it didn't. */
  readonly resetAt: string | null;
  /** When its first Cell stopped. */
  readonly since: string;
  /** What ends it: the reset, for Cells that carry on at it; else nothing but the person. */
  readonly waits: "reset" | "you";
  /** The Cells it holds, the longest held first. */
  readonly cells: ReadonlyArray<HeldCell>;
}

const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

/**
 * The condition that holds this Cell, by its key; null for a Cell nothing shared holds. A
 * settled run is the person's own close of it, and a newer run is no longer the stopped one.
 */
export function heldBy(shell: Shell): string | null {
  if (shell.status !== "failed" || shell.lastErrorClass !== "usage_limit") return null;
  if (shell.latestRunId === null || shell.settledOverride === "settled") return null;
  const resetAt = Date.parse(limitResetAt(shell) ?? "");
  // To the minute: one refusal's reset reads a few seconds apart across Cells.
  const window = Number.isNaN(resetAt) ? "unknown" : String(Math.round(resetAt / 60_000));
  return `limit:${shell.providerInstanceId}:${window}`;
}

/**
 * Each shared stop among the Cells in reach, the oldest first. Sub-tasks are left out, as
 * their parent stands for them, and so is what the person put away: settled, snoozed, archived.
 */
export function conditionsOf(
  shells: ReadonlyArray<Shell>,
  now: number,
  autoResume: boolean,
): ReadonlyArray<Condition> {
  const aski = askiThreadOf(shells);
  const groups = new Map<string, Array<{ readonly shell: Shell; readonly at: number }>>();
  for (const shell of shells) {
    if (shell.deletedAt !== null || shell.archivedAt !== null || shell.settledAt !== null) continue;
    if (shell.id === aski || shell.lineage.rootThreadId === aski) continue;
    if (shell.lineage.parentThreadId !== null || isSnoozed(shell, now)) continue;
    const key = heldBy(shell);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), { shell, at: runEnded(shell) }]);
  }
  return [...groups]
    .map(([key, held]): Condition => {
      const cells = held
        .toSorted((a, b) => a.at - b.at)
        .map(({ shell, at }): HeldCell => ({
          threadId: shell.id,
          projectId: shell.projectId,
          title: shell.title,
          since: iso(at),
          carriesOn: carriesOn(shell, now, autoResume),
        }));
      const first = held[0]!.shell;
      return {
        key,
        kind: "limit",
        providerInstanceId: first.providerInstanceId,
        resetAt: limitResetAt(first),
        since: cells[0]!.since,
        waits: cells.some((cell) => cell.carriesOn) ? "reset" : "you",
        cells,
      };
    })
    .toSorted((a, b) => a.since.localeCompare(b.since));
}
