// A Cell's face from T3's list status, as the Mac reads it (`apps/web/src/stemcells/tabs/
// cellMood.ts`): asking while it waits on you, crashed once its run failed, at work while it
// runs, cheering a moment once a turn lands, then resting; asleep once settled, snoozed or its
// prompt cache has gone cold. While its machine is out of reach it peers.

import type { Activity, Mood } from "./kit";
import type { EnvironmentThreadShell, ThreadListV2Status } from "../upstream/threads";

/** How long a Cell cheers once its turn lands, as the Mac's does. */
export const CHEER_MS = 6_000;
/** Codex keeps a prompt cache half an hour (`apps/web/src/stemcells/upstream/cellWork.ts`). */
const CODEX_CACHE_MS = 30 * 60_000;

export interface Face {
  readonly mood: Mood;
  readonly activity?: Activity | undefined;
}

type FaceShell = Pick<
  EnvironmentThreadShell,
  "interactionMode" | "hasActionableProposedPlan" | "latestRun" | "runtime" | "blockedOnThreadWait"
>;

/**
 * The face of a Cell whose chat `thread` is in `status` at `now` (ms),
 * `driver` its provider's; `away` once it is put away, `lineDown` while its
 * machine is out of reach.
 */
export function faceOf(
  thread: FaceShell,
  status: ThreadListV2Status,
  input: {
    readonly now: number;
    readonly driver: string | null;
    readonly away?: boolean;
    readonly lineDown?: boolean;
  },
): Face {
  if (input.lineDown) return { mood: "peering" };
  switch (status) {
    case "approval":
      return { mood: "needsApproval" };
    case "input":
      return { mood: "needsYou" };
    case "failed":
    case "limited":
      return { mood: "crashed" };
    case "working":
      return { mood: "awake", activity: "thinking" };
    default:
  }
  if (thread.runtime?.status === "running" && thread.blockedOnThreadWait === true)
    return { mood: "awake", activity: "waiting" };
  if (thread.interactionMode === "plan" && thread.hasActionableProposedPlan)
    return { mood: "needsYou" };
  if (input.away) return { mood: "asleep" };
  const run = thread.latestRun;
  const landedAt =
    run?.status === "completed" && run.completedAt !== null ? Date.parse(run.completedAt) : NaN;
  if (!Number.isFinite(landedAt)) return { mood: "awake" };
  if (input.now - landedAt < CHEER_MS) return { mood: "pleased" };
  if (input.driver === "codex" && input.now >= landedAt + CODEX_CACHE_MS) return { mood: "asleep" };
  return { mood: "awake" };
}

/** When `faceOf` would change next with nothing else changing; undefined when it holds. */
export function faceTurnsAt(
  thread: FaceShell,
  driver: string | null,
  now: number,
): number | undefined {
  const run = thread.latestRun;
  if (run?.status !== "completed" || run.completedAt === null) return undefined;
  const landedAt = Date.parse(run.completedAt);
  const turns = [landedAt + CHEER_MS, driver === "codex" ? landedAt + CODEX_CACHE_MS : Infinity];
  const next = Math.min(...turns.filter((at) => at > now));
  return Number.isFinite(next) ? next : undefined;
}
