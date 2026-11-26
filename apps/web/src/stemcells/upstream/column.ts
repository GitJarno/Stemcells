/**
 * What the Cells' column reads of upstream's chats beside the needs stream:
 * those asleep (settled or snoozed) and those pinned on the primary server,
 * when the person last brought each forward, how many settled ones it keeps
 * back, and how a row opens its chat (stemcells/tasks/awake-asleep.md).
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import {
  type OlderSettled,
  unloadedOlderSettledCount,
} from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";

import { useNowMinute } from "../../hooks/useNowMinute";
import { useQuietThreadShells } from "../../state/entities";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useOlderSettledShelf } from "../../state/olderSettledShelf";
import { isAskisInstance } from "../aski/setup";
import type { Launchable } from "../rail/awake";

export interface ShelvedCell {
  readonly environmentId: string;
  readonly threadId: string;
  readonly projectId: string;
  readonly title: string;
}

export interface AsleepCell extends ShelvedCell {
  /** When it went to sleep: its settle, or its snooze. */
  readonly since: string;
  /** When a timed sleep (upstream's snooze) wakes; null for one slept until woken. */
  readonly wakesAt: string | null;
}

export interface Shelves {
  /** Asleep Cells, settled or snoozed, the latest asleep first. */
  readonly asleep: ReadonlyArray<AsleepCell>;
  /** Pinned Cells, in the order the person pinned them. */
  readonly pinned: ReadonlyArray<ShelvedCell>;
  /** What Awake's order reads of each Cell (`rail/awake.ts`), by its thread. */
  readonly launches: ReadonlyMap<string, Launchable>;
}

const shelved = (shell: EnvironmentThreadShell): ShelvedCell => ({
  environmentId: shell.environmentId,
  threadId: shell.id,
  projectId: shell.projectId,
  title: shell.title,
});

const launchOf = (shell: EnvironmentThreadShell): Launchable => ({
  id: shell.id,
  createdAt: shell.createdAt,
  unsettledAt: shell.unsettledAt,
  snoozedUntil: shell.snoozedUntil,
  latestUserAuthoredMessageAt: shell.latestUserAuthoredMessageAt,
  latestRun:
    shell.latestRun?.requestedAt == null ? null : { requestedAt: shell.latestRun.requestedAt },
});

/**
 * The asleep and the pinned Cells among a server's chats at `now`: a Cell's
 * own chats, kept, never Aski's, which has its own tab. Settled as upstream's
 * list reads it (`settledOverride`), which its auto-settle sets too; snoozed
 * as upstream's sidebar reads it, until its time or a raised hand.
 */
export function shelvesOf(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: string | null,
  now: string,
): Shelves {
  const cells = shells.filter(
    (shell) =>
      shell.environmentId === environmentId &&
      shell.lineage.parentThreadId === null &&
      shell.archivedAt === null &&
      shell.deletedAt === null &&
      !isAskisInstance(shell.providerInstanceId),
  );
  const settled = cells
    .filter((shell) => shell.settledOverride === "settled")
    .map((shell) => ({
      ...shelved(shell),
      since: shell.settledAt ?? shell.updatedAt,
      wakesAt: null,
    }));
  const snoozed = cells
    .filter((shell) => shell.settledOverride !== "settled" && effectiveSnoozed(shell, { now }))
    .map((shell) => ({
      ...shelved(shell),
      since: shell.snoozedAt ?? shell.updatedAt,
      wakesAt: shell.snoozedUntil,
    }));
  const pinned = cells
    .filter((shell) => shell.pinnedAt !== null)
    .toSorted(
      (a, b) =>
        (a.pinOrderKey ?? "\uffff").localeCompare(b.pinOrderKey ?? "\uffff") ||
        (a.pinnedAt ?? "").localeCompare(b.pinnedAt ?? ""),
    );
  return {
    asleep: [...settled, ...snoozed].toSorted((a, b) => b.since.localeCompare(a.since)),
    pinned: pinned.map(shelved),
    launches: new Map(cells.map((shell) => [shell.id, launchOf(shell)])),
  };
}

/** The primary server's asleep and pinned Cells, read again when a chat's shell or the minute changes. */
export function useShelves(): Shelves {
  const shells = useQuietThreadShells();
  const environmentId = usePrimaryEnvironmentId();
  const now = useNowMinute();
  return shelvesOf(shells, environmentId, `${now}:00.000Z`);
}

/**
 * Settled chats the server keeps back from this window, older than the newest it sends
 * (`omitOlderSettled`), in the projects `shown` lets through, less those a page brought in.
 */
export function keptBackOf(
  older: OlderSettled | null,
  environmentId: EnvironmentId | null,
  shells: ReadonlyArray<EnvironmentThreadShell>,
  shown: (projectId: string) => boolean,
): number {
  if (older === null || environmentId === null) return 0;
  const projectIds = [...older.counts.keys()].filter(shown);
  return unloadedOlderSettledCount({
    olderSettled: () => older,
    scopes: [{ environmentId, projectIds }],
    threads: shells,
  });
}

/** The primary server's settled chats it keeps back, for Asleep to count with its own. */
export function useSettledKeptBack(shown: (projectId: string) => boolean): number {
  const shells = useQuietThreadShells();
  const environmentId = usePrimaryEnvironmentId();
  const shelf = useOlderSettledShelf({
    scopes: environmentId === null ? [] : [{ environmentId, projectIds: null }],
    expanded: false,
    visibleCount: 0,
  });
  const older =
    environmentId === null ? null : (shelf.environments.get(environmentId)?.older ?? null);
  return keptBackOf(older, environmentId, shells, shown);
}

/** Goes to a Cell's chat; the workspace shows it where opening a chat goes (`tabs/layout.ts`, `showRoute`). */
export function useOpenCell(): (cell: { environmentId: string; threadId: string }) => void {
  const navigate = useNavigate();
  return (cell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId: cell.environmentId, threadId: cell.threadId },
    });
}
