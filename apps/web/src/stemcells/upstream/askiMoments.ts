/**
 * What Aski's moments read from upstream besides what its eyes read: how
 * each chat's latest run went, who started each chat, Aski's own run, the
 * pull requests that merged, armed limit recoveries, and what a landed run
 * did (compacted, files added).
 * `askiMoments.contract.test.ts` pins what they rely on.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell, ThreadRunSummary } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import {
  useQuietThreadShell,
  useThreadCheckpointSummaries,
  useThreadShells,
  useThreadStatus,
  useThreadVisibleTurnItems,
} from "../../state/entities";
import { useCheckpointDiff } from "../../state/queries";
import type { Standing } from "../rail/projects";
import type { CellRef } from "../tabs/layout";
import { useOpenChats } from "./askiEyes";
import { threadRefOf } from "./routes";

/** A run that ended without finishing its work. */
export interface RunDropped {
  /** When it ended, Unix milliseconds. */
  readonly at: number;
}

/** A chat's latest run as a moment reads it: its id, how it stands, and its times in Unix milliseconds. */
export interface MomentRun {
  readonly id: string;
  /** Ended and done its work; ended without it; or still going. */
  readonly ended: "landed" | "dropped" | "cancelled" | null;
  readonly requestedAt: number | null;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

/** An open chat as Aski's moments read it. */
export interface MomentChat {
  readonly key: string;
  readonly environmentId: string;
  readonly threadId: string;
  readonly title: string;
  readonly standing: Standing;
  readonly run: MomentRun | null;
  /** When it was made, Unix milliseconds. */
  readonly createdAt: number;
  /** Started by a chat through Stemcells' tools (`t3_thread_launch`), not by the person. */
  readonly launched: boolean;
  readonly recovery: ReturnType<typeof recoveryOf>;
}

/**
 * Ended without finishing: failed, or interrupted. The person can interrupt
 * a run too, but not while the page can't reach the server, so one that
 * ends in a silence was lost.
 */
const DROPPED: ReadonlySet<string> = new Set(["failed", "interrupted"]);
const LANDED: ReadonlySet<string> = new Set(["completed"]);
const CANCELLED: ReadonlySet<string> = new Set(["cancelled", "rolled_back"]);

const msOf = (at: string | null | undefined): number | null => {
  if (at === null || at === undefined) return null;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? null : ms;
};

function runOf(run: ThreadRunSummary | null, updatedAt: string): MomentRun | null {
  if (run === null) return null;
  const ended = LANDED.has(run.status)
    ? "landed"
    : DROPPED.has(run.status)
      ? "dropped"
      : CANCELLED.has(run.status)
        ? "cancelled"
        : null;
  return {
    id: run.runId,
    ended,
    requestedAt: msOf(run.requestedAt),
    startedAt: msOf(run.startedAt),
    // An ended run without its own time ended when the chat last changed.
    endedAt: ended === null ? null : msOf(run.completedAt ?? updatedAt),
  };
}

/** Every chat's latest run that ended without finishing its work, archived chats aside. */
export function useRunsDropped(): ReadonlyArray<RunDropped> {
  const shells = useThreadShells();
  return shells.flatMap((chat) => {
    if (chat.archivedAt !== null) return [];
    const run = runOf(chat.latestRun, chat.updatedAt);
    return run?.ended === "dropped" && run.endedAt !== null ? [{ at: run.endedAt }] : [];
  });
}

/** The open chats as the moments read them, Aski's own aside, `aski` being Aski's chat. */
export function useMomentChats(aski: CellRef | null, now: string): ReadonlyArray<MomentChat> {
  return useOpenChats(aski, now).map(({ key, shell, standing }) => ({
    key,
    environmentId: shell.environmentId,
    threadId: shell.id,
    title: shell.title,
    standing,
    run: runOf(shell.latestRun, shell.updatedAt),
    createdAt: msOf(shell.createdAt) ?? 0,
    launched: shell.source.createdBy === "agent" && shell.source.creationSource === "mcp",
    recovery: recoveryOf(shell),
  }));
}

/** Aski's own latest run. */
export function useAskiRun(aski: CellRef | null): MomentRun | null {
  const shell = useQuietThreadShell(aski ? threadRefOf(aski) : null);
  return shell ? runOf(shell.latestRun, shell.updatedAt) : null;
}

/** A merged pull request of a chat, as a moment reads it. */
export interface MomentMerge {
  /** Its repository and number, the same for every chat it is linked to. */
  readonly key: string;
  readonly base: string;
  readonly mergedAt: number;
  /** Lines added and deleted. */
  readonly lines: number;
}

/**
 * The merged pull requests of every chat, Aski's own and archived chats
 * aside. Settled chats count: a merge settles its chat in the same sync
 * that reads it, so the open chats never see it.
 */
export function useMerges(aski: CellRef | null): ReadonlyArray<MomentMerge> {
  const shells = useThreadShells();
  return shells.flatMap((chat) =>
    chat.archivedAt !== null ||
    (aski !== null && chat.environmentId === aski.environmentId && chat.id === aski.threadId)
      ? []
      : mergesOf(chat),
  );
}

/** The pull requests linked to `shell` that have merged, by their last sync. */
export function mergesOf(shell: EnvironmentThreadShell): MomentMerge[] {
  return shell.pullRequests.flatMap((link) => {
    const snapshot = link.snapshot;
    if (link.source === "stack-dismissed" || snapshot?.state !== "merged") return [];
    const mergedAt = msOf(snapshot.mergedAt);
    if (mergedAt === null) return [];
    return [
      {
        key: `${link.host}/${link.repository}#${link.number}`,
        base: snapshot.baseBranch,
        mergedAt,
        lines: (snapshot.additions ?? 0) + (snapshot.deletions ?? 0),
      },
    ];
  });
}

/** A chat's limit recovery, if one is armed: the run a limit stopped, when the window opens again, and whether it carries on by itself then. */
export function recoveryOf(
  shell: EnvironmentThreadShell,
): { readonly runId: string; readonly resetAt: number; readonly autoResume: boolean } | null {
  const recovery = shell.limitRecovery;
  const resetAt = msOf(recovery?.resetAt);
  return recovery == null || resetAt === null
    ? null
    : { runId: recovery.runId, resetAt, autoResume: recovery.autoResume };
}

/** What a run did, read from its chat's detail once loaded: whether it compacted on its own, and the diff of its checkpoint. Null while not known yet. */
export interface RunLook {
  readonly compacted: boolean | null;
  /** Empty when the run changed no files. */
  readonly diff: string | null;
}

/** Loads chat `threadId`'s detail while mounted, and says what its run `runId` did. */
export function useRunLook(environmentId: string, threadId: string, runId: string): RunLook {
  const thread = scopeThreadRef(environmentId as EnvironmentId, threadId as ThreadId);
  const status = useThreadStatus(thread);
  const items = useThreadVisibleTurnItems(thread);
  const checkpoints = useThreadCheckpointSummaries(thread);
  // A cached detail may not hold the run yet; a live one that holds it does.
  const ran = items.map(({ item }) => item).filter((item) => item.runId === runId);
  const loaded = status === "live" && ran.length > 0;
  // A compaction the person asked for comes of their own `/compact`.
  const asked = ran.some(
    (item) => item.type === "user_message" && item.text.trim().startsWith("/compact"),
  );
  const checkpoint = checkpoints.find(
    (candidate) => candidate.runId === runId && candidate.status === "ready",
  );
  // A run that changed no files needs no diff read.
  const turn =
    checkpoint !== undefined && checkpoint.files.length > 0 ? checkpoint.checkpointTurnCount : null;
  const diff = useCheckpointDiff({
    environmentId: environmentId as EnvironmentId,
    threadId: threadId as ThreadId,
    fromTurnCount: turn === null ? null : turn - 1,
    toTurnCount: turn,
    ignoreWhitespace: false,
  });
  return {
    compacted: loaded ? !asked && ran.some((item) => item.type === "compaction") : null,
    // A diff that can't be read adds no files.
    diff:
      checkpoint === undefined
        ? null
        : turn === null || diff.error !== null
          ? ""
          : (diff.data?.diff ?? null),
  };
}
