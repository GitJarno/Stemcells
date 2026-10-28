/**
 * What Settings › Lineage reads from upstream: every chat on every
 * connected machine, open and archived (the archive through upstream's own
 * query, as Settings › Archive reads it), with its project, its provider and
 * whether its turn runs, each as one life of the name its id deals.
 */
import { useAtomValue } from "@effect/atom-react";
import {
  type EnvironmentThreadShell,
  presentThreadShell,
  resolveThreadProviderStack,
  threadRuntimeIsActive,
} from "@t3tools/client-runtime/state/models";
import { ProviderDriverKind } from "@t3tools/contracts";

import { isSidebarSubagentThread } from "../../components/Sidebar.logic";
import { providerClients } from "../../components/settings/providerDriverMeta";
import { useArchivedThreadSnapshots } from "../../lib/archivedThreadsState";
import { useProjects, useThreadShells } from "../../state/entities";
import { useEnvironmentProviders } from "../../state/environments";
import { environmentSummaries } from "../../state/presentation";
import { cellNameOf } from "../cell/name";
import type { Life } from "../lineage/lineage";

const msOf = (iso: string | null): number => {
  const ms = iso === null ? Number.NaN : Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

/** Every life the person's chats have lived, and whether the archive is still being read. */
export function useLives(): { readonly lives: readonly Life[]; readonly loading: boolean } {
  const open = useThreadShells();
  const environmentIds = useAtomValue(environmentSummaries.environmentIdsAtom);
  const archive = useArchivedThreadSnapshots(environmentIds);
  const projects = useProjects();
  const providers = useEnvironmentProviders();

  return {
    lives: livesOf(open, archive.snapshots, projects, providers),
    loading: archive.isLoading,
  };
}

function livesOf(
  open: ReadonlyArray<EnvironmentThreadShell>,
  snapshots: ReturnType<typeof useArchivedThreadSnapshots>["snapshots"],
  projects: ReturnType<typeof useProjects>,
  providers: ReturnType<typeof useEnvironmentProviders>,
): Life[] {
  const projectTitles = new Map<string, string>([
    ...snapshots.flatMap(({ environmentId, snapshot }) =>
      snapshot.projects.map(
        (project) => [`${environmentId}:${project.id}`, project.title] as const,
      ),
    ),
    ...projects.map(
      (project) =>
        [
          `${project.environmentId}:${project.id}`,
          project.isScratch ? "No project" : project.title,
        ] as const,
    ),
  ]);
  const archived = snapshots.flatMap(({ environmentId, snapshot }) =>
    snapshot.threads.map((thread) => presentThreadShell(environmentId, thread)),
  );
  const seen = new Set<string>();
  return [...open, ...archived].flatMap((shell: EnvironmentThreadShell): Life[] => {
    const key = `${shell.environmentId}:${shell.id}`;
    if (seen.has(key) || isSidebarSubagentThread(shell)) return [];
    seen.add(key);
    const instanceId = resolveThreadProviderStack(shell).at(-1) ?? null;
    const listed = providers.get(shell.environmentId)?.find((p) => p.instanceId === instanceId);
    // An instance this client hasn't listed reads as its id, a default instance's being its driver.
    const driver: string | null = listed?.driver ?? instanceId;
    return [
      {
        key,
        threadId: shell.id,
        name: cellNameOf(shell.id),
        driver,
        provider:
          (driver === null
            ? undefined
            : providerClients.get(ProviderDriverKind.make(driver))?.label) ??
          driver ??
          "Unknown provider",
        project: projectTitles.get(`${shell.environmentId}:${shell.projectId}`) ?? "No project",
        title: shell.title,
        born: msOf(shell.createdAt),
        lastSeen: msOf(shell.updatedAt),
        archived: shell.archivedAt !== null,
        running: threadRuntimeIsActive(shell.runtime),
      },
    ];
  });
}
