/**
 * What Aski's moments read from upstream besides what its eyes read: how
 * each chat's latest run went, who started each chat, and Aski's own run.
 * `askiMoments.contract.test.ts` pins what they rely on.
 */
import type { ThreadRunSummary } from "@t3tools/client-runtime/state/shell";

import { useQuietThreadShell, useThreadShells } from "../../state/entities";
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
  readonly title: string;
  readonly standing: Standing;
  readonly run: MomentRun | null;
  /** When it was made, Unix milliseconds. */
  readonly createdAt: number;
  /** Started by a chat through Stemcells' tools (`t3_thread_launch`), not by the person. */
  readonly launched: boolean;
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
    title: shell.title,
    standing,
    run: runOf(shell.latestRun, shell.updatedAt),
    createdAt: msOf(shell.createdAt) ?? 0,
    launched: shell.source.createdBy === "agent" && shell.source.creationSource === "mcp",
  }));
}

/** Aski's own latest run. */
export function useAskiRun(aski: CellRef | null): MomentRun | null {
  const shell = useQuietThreadShell(aski ? threadRefOf(aski) : null);
  return shell ? runOf(shell.latestRun, shell.updatedAt) : null;
}
