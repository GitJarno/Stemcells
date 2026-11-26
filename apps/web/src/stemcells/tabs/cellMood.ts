/**
 * A Cell's face from its chat's status: crashed when its run failed, asking (`needsApproval`,
 * `needsYou`) while it waits on you, cheering then resting once a turn lands, peering while its
 * line is down. It sleeps only while asleep: a cold prompt cache leaves it awake, as the art has
 * no doze (stemcells/tasks/awake-asleep.md, decision 6).
 */
import type { Activity } from "../cell/activity";
import type { Mood } from "../cell/look";
import type { CellStatus } from "../upstream/status";

const MOOD_BY_STATUS: Readonly<Record<CellStatus, Mood>> = {
  "Pending Approval": "needsApproval",
  "Awaiting Input": "needsYou",
  "Guest Request": "needsYou",
  "Plan Ready": "needsYou",
  Failed: "crashed",
  Working: "awake",
  Connecting: "awake",
  Waiting: "awake",
  Completed: "pleased",
};

/** The face the status alone says: pleased once a turn has landed and you haven't looked. */
export function moodOfStatus(status: CellStatus | null): Mood {
  return status === null ? "awake" : MOOD_BY_STATUS[status];
}

/** How long a Cell cheers once its turn lands, as the original's did. */
export const CHEER_MS = 6_000;

/**
 * The face at `now` for a chat in `status` that landed at `landedAt` and sleeps until `wakesAt`
 * (`useCellWakesAt`). While `lineDown` (`useCellLineDown`) it peers, whatever the chat last said:
 * nothing it shows can change until the line is back. Asking, at work or crashed, it shows that
 * even asleep: a raised hand wakes it.
 */
export function moodAt(
  status: CellStatus | null,
  landedAt: number | null,
  now: number,
  lineDown = false,
  wakesAt: number | null = null,
): Mood {
  if (lineDown) return "peering";
  if (status !== null && status !== "Completed") return moodOfStatus(status);
  if (wakesAt !== null && now < wakesAt) return "asleep";
  if (landedAt === null) return "awake";
  return now - landedAt < CHEER_MS ? "pleased" : "awake";
}

/** When the face `moodAt` gives changes next with nothing else changing; undefined when it holds. */
export function moodTurnsAt(
  status: CellStatus | null,
  landedAt: number | null,
  now: number,
  wakesAt: number | null = null,
): number | undefined {
  if (status !== null && status !== "Completed") return undefined;
  const next = Math.min(
    ...[landedAt === null ? Infinity : landedAt + CHEER_MS, wakesAt ?? Infinity].filter(
      (at) => at > now,
    ),
  );
  return Number.isFinite(next) ? next : undefined;
}

/**
 * What the status alone says the Cell is doing: waiting on another chat or
 * its background work, or watching its subagents work on in the background
 * (`subagentsAway`). What a working Cell is doing needs its tool calls.
 */
export function activityOfStatus(
  status: CellStatus | null,
  subagentsAway = 0,
): Activity | undefined {
  if (status !== "Waiting") return undefined;
  return subagentsAway > 0 ? "delegating" : "waiting";
}

/** Thinking with no call in flight, raw and shown: the only time a Cell's thought can go deep (`useCellDeep`). */
export const thinkingQuietly = (raw: Activity | undefined, shown: Activity | undefined): boolean =>
  raw === "thinking" && shown === "thinking";
