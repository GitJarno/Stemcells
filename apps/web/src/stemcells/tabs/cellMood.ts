/**
 * A Cell's face from its chat's status: crashed when its run failed, asking
 * while it waits on you (leave to run or change something plays
 * `needsApproval`; an answer or a plan to accept, `needsYou`), awake while
 * it works. Once a turn lands it cheers a moment and rests awake; it sleeps
 * once its chat's prompt cache has gone cold, so a sleeping Cell is one
 * whose next message costs a cold start. While its line is down it peers.
 */
import type { Activity } from "../cell/activity";
import type { Mood } from "../cell/look";
import type { CellStatus } from "../upstream/status";

const MOOD_BY_STATUS: Readonly<Record<CellStatus, Mood>> = {
  "Pending Approval": "needsApproval",
  "Awaiting Input": "needsYou",
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
 * The face at `now` for a chat in `status` whose last turn landed at
 * `landedAt` and whose prompt cache goes cold at `coldAt` (ms; null before a
 * turn has landed, undefined when nothing says when the cache goes cold).
 * While `lineDown` (its machine reconnecting or offline, its provider out:
 * `useCellLineDown`) it peers, whatever the chat last said: nothing it
 * shows can change until the line is back.
 */
export function moodAt(
  status: CellStatus | null,
  landedAt: number | null,
  coldAt: number | undefined,
  now: number,
  lineDown = false,
): Mood {
  if (lineDown) return "peering";
  if (status !== null && status !== "Completed") return moodOfStatus(status);
  if (landedAt === null) return "awake";
  if (now - landedAt < CHEER_MS) return "pleased";
  return coldAt !== undefined && now >= coldAt ? "asleep" : "awake";
}

/** When the face `moodAt` gives changes next with nothing else changing; undefined when it holds. */
export function moodTurnsAt(
  status: CellStatus | null,
  landedAt: number | null,
  coldAt: number | undefined,
  now: number,
): number | undefined {
  if ((status !== null && status !== "Completed") || landedAt === null) return undefined;
  const next = Math.min(...[landedAt + CHEER_MS, coldAt ?? Infinity].filter((at) => at > now));
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
