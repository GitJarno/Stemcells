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
  /** The run the limit stopped, which a "continue" picks up. */
  readonly runId: string;
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
  /** When the limit resets, as the refusals said: the latest of them; null when none did. */
  readonly resetAt: string | null;
  /** When its first Cell stopped. */
  readonly since: string;
  /** What ends it: the reset, for Cells that carry on at it; else nothing but the person. */
  readonly waits: "reset" | "you";
  /** The Cells it holds, the longest held first. */
  readonly cells: ReadonlyArray<HeldCell>;
}

const iso = (ms: number) => DateTime.formatIso(DateTime.makeUnsafe(ms));

/** Refusals of one window state its reset a little apart; further apart is another window. */
const SAME_RESET_MS = 2 * 60_000;

interface Held {
  readonly shell: Shell;
  readonly runId: string;
  readonly stoppedAt: number;
  /** Its reset in ms; null when the refusal stated none. */
  readonly resetAt: number | null;
}

/** A run a usage limit stopped, still the Cell's latest and not settled by the person. */
function heldOf(shell: Shell): Held | null {
  if (shell.status !== "failed" || shell.lastErrorClass !== "usage_limit") return null;
  if (shell.latestRunId === null || shell.settledOverride === "settled") return null;
  const resetAt = Date.parse(limitResetAt(shell) ?? "");
  return {
    shell,
    runId: shell.latestRunId,
    stoppedAt: runEnded(shell),
    resetAt: Number.isNaN(resetAt) ? null : resetAt,
  };
}

/**
 * Each shared stop among the Cells in reach, the oldest first. Left out: a sub-task, as its
 * parent stands for it; what the person put away (settled, snoozed, archived); and a Cell with
 * an ask (`asking`), which is the person's to answer first and stands in Input.
 */
export function conditionsOf(
  shells: ReadonlyArray<Shell>,
  now: number,
  autoResume: boolean,
  asking: ReadonlySet<string> = new Set(),
): ReadonlyArray<Condition> {
  const aski = askiThreadOf(shells);
  const byAccount = new Map<string, Array<Held>>();
  for (const shell of shells) {
    if (shell.deletedAt !== null || shell.archivedAt !== null || shell.settledAt !== null) continue;
    if (shell.id === aski || shell.lineage.rootThreadId === aski) continue;
    if (shell.lineage.parentThreadId !== null || isSnoozed(shell, now)) continue;
    if (asking.has(shell.id)) continue;
    const held = heldOf(shell);
    if (held === null) continue;
    byAccount.set(shell.providerInstanceId, [
      ...(byAccount.get(shell.providerInstanceId) ?? []),
      held,
    ]);
  }
  const conditions: Array<Condition> = [];
  for (const [providerInstanceId, account] of byAccount) {
    // One window's Cells stand together: resets within `SAME_RESET_MS` of the window's first.
    const windows: Array<Array<Held>> = [];
    const stated = account
      .filter((held) => held.resetAt !== null)
      .toSorted((a, b) => a.resetAt! - b.resetAt!);
    for (const held of stated) {
      const window = windows.at(-1);
      if (window !== undefined && held.resetAt! - window[0]!.resetAt! <= SAME_RESET_MS) {
        window.push(held);
      } else windows.push([held]);
    }
    const unstated = account.filter((held) => held.resetAt === null);
    if (unstated.length > 0) windows.push(unstated);
    for (const window of windows) {
      const first = window[0]!.resetAt;
      const last = window.at(-1)!.resetAt;
      const cells = window
        .toSorted((a, b) => a.stoppedAt - b.stoppedAt)
        .map((held): HeldCell => ({
          threadId: held.shell.id,
          projectId: held.shell.projectId,
          title: held.shell.title,
          runId: held.runId,
          since: iso(held.stoppedAt),
          carriesOn: carriesOn(held.shell, now, autoResume),
        }));
      conditions.push({
        key: `limit:${providerInstanceId}:${first === null ? "unknown" : Math.floor(first / 60_000)}`,
        kind: "limit",
        providerInstanceId,
        resetAt: last === null ? null : iso(last),
        since: cells[0]!.since,
        waits: cells.some((cell) => cell.carriesOn) ? "reset" : "you",
        cells,
      });
    }
  }
  return conditions.toSorted((a, b) => a.since.localeCompare(b.since));
}

/** Which condition holds each Cell, by its thread. */
export function holdsOf(conditions: ReadonlyArray<Condition>): ReadonlyMap<string, string> {
  return new Map(
    conditions.flatMap((condition) =>
      condition.cells.map((cell) => [cell.threadId, condition.key]),
    ),
  );
}
