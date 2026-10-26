/**
 * What the Cells' column reads of upstream's chats beside the needs stream:
 * those settled and those pinned on the primary server, and how a row opens
 * its chat (stemcells/tasks/left-column.md).
 */
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { useNavigate } from "@tanstack/react-router";

import { useQuietThreadShells } from "../../state/entities";
import { usePrimaryEnvironmentId } from "../../state/environments";
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

/** Goes to a Cell's chat; the workspace shows it where opening a chat goes (`tabs/layout.ts`, `showRoute`). */
export function useOpenCell(): (cell: { environmentId: string; threadId: string }) => void {
  const navigate = useNavigate();
  return (cell) =>
    void navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId: cell.environmentId, threadId: cell.threadId },
    });
}
