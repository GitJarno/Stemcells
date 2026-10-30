/**
 * What the Cells' column reads of upstream's chats beside the needs stream:
 * those settled and those pinned on the primary server, how many settled ones
 * it keeps back, and how a row opens its chat (stemcells/tasks/left-column.md).
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import {
  type OlderSettled,
  unloadedOlderSettledCount,
} from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";

import { useQuietThreadShells } from "../../state/entities";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useOlderSettledShelf } from "../../state/olderSettledShelf";
import { isAskisInstance } from "../aski/setup";

export interface ShelvedCell {
  readonly environmentId: string;
  readonly threadId: string;
  readonly projectId: string;
  readonly title: string;
}

export interface Shelves {
  /** Settled Cells, the latest settled first. */
  readonly settled: ReadonlyArray<ShelvedCell>;
  /** Pinned Cells, in the order the person pinned them. */
  readonly pinned: ReadonlyArray<ShelvedCell>;
}

const shelved = (shell: EnvironmentThreadShell): ShelvedCell => ({
  environmentId: shell.environmentId,
  threadId: shell.id,
  projectId: shell.projectId,
  title: shell.title,
});

/**
 * The settled and the pinned Cells among a server's chats: a Cell's own
 * chats, kept, never Aski's, which has its own tab. Settled as upstream's
 * list reads it (`settledOverride`), which its auto-settle sets too.
 */
export function shelvesOf(
  shells: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: string | null,
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
    .toSorted((a, b) => (b.settledAt ?? b.updatedAt).localeCompare(a.settledAt ?? a.updatedAt));
  const pinned = cells
    .filter((shell) => shell.pinnedAt !== null)
    .toSorted(
      (a, b) =>
        (a.pinOrderKey ?? "￿").localeCompare(b.pinOrderKey ?? "￿") ||
        (a.pinnedAt ?? "").localeCompare(b.pinnedAt ?? ""),
    );
  return { settled: settled.map(shelved), pinned: pinned.map(shelved) };
}

/** The primary server's settled and pinned Cells, read again only when a chat's shell changes. */
export function useShelves(): Shelves {
  const shells = useQuietThreadShells();
  const environmentId = usePrimaryEnvironmentId();
  return shelvesOf(shells, environmentId);
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

/** The primary server's settled chats it keeps back, for Settled to count with its own. */
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
