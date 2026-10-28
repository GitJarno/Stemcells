// What Settings › Disk takes from upstream: its settings layout and
// controls, a request to the primary environment as upstream authenticates
// one, the connected environments and each one's host resources, and its
// project commands, to open a Cell in a machine's Disk project with a draft.

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { canCreateProjectInEnvironment } from "@t3tools/client-runtime/operations/projects";
import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { newProjectId } from "~/lib/utils";
import { readProjects, waitForProject } from "~/state/entities";
import {
  useConnectedEnvironmentIds,
  useEnvironments,
  usePrimaryEnvironmentId,
} from "~/state/environments";
import { projectEnvironment } from "~/state/projects";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { openDiskProject } from "../../../../../stemcells/disk/project.ts";

export type { EnvironmentId };
export { usePrimaryEnvironmentId };

export {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "~/components/settings/settingsLayout";
export { useNowMinuteMs, useNowSecond } from "./settings";
export { Badge } from "~/components/ui/badge";
export { Button } from "~/components/ui/button";
export { Input } from "~/components/ui/input";
export { Spinner } from "~/components/ui/spinner";
export { toastManager } from "~/components/ui/toast";
export { formatRelativeTimeLabel };

/**
 * A GET to the primary environment's server: the session cookie in a browser
 * on its origin, the desktop app's bearer token otherwise.
 */
export async function getFromPrimary(
  pathname: string,
  searchParams?: Record<string, string>,
): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname, searchParams), {
    credentials: bearerToken ? "omit" : "include",
    headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
  });
}

/** A JSON request that changes something on the primary environment's server, sent as `getFromPrimary` is. */
export async function sendToPrimary(
  method: "POST" | "PUT" | "DELETE",
  pathname: string,
  body?: unknown,
): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname), {
    method,
    credentials: bearerToken ? "omit" : "include",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/**
 * Opens a new Cell in `environmentId`'s Disk project, made there when the machine has none, with
 * `text` waiting in its composer, unsent. Null when that machine can't make a project now: not
 * connected, or a server without a folder for new projects.
 */
export function useOpenDiskCell(
  environmentId: EnvironmentId | null,
): ((text: string) => Promise<boolean>) | null {
  const { environments } = useEnvironments();
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const updateProject = useAtomCommand(projectEnvironment.update, { reportFailure: false });
  const handleNewThread = useNewThreadHandler();
  const environment = environments.find((entry) => entry.environmentId === environmentId);
  const projectsRoot = canCreateProjectInEnvironment(environment?.connection.phase)
    ? environment?.serverConfig?.newProjectsRoot
    : undefined;
  if (environmentId === null || projectsRoot === undefined) return null;
  return async (text) => {
    const project = await openDiskProject(projectsRoot, {
      projectIn: (folder) =>
        findProjectByPath(
          readProjects().filter((candidate) => candidate.environmentId === environmentId),
          folder,
        ) ?? null,
      create: async (input) => {
        const projectId = newProjectId();
        const result = await createProject({
          environmentId,
          input: { projectId, ...input, createWorkspaceRootIfMissing: true },
        });
        return result._tag === "Success" ? projectId : null;
      },
      writeFile: async (input) => (await writeFile({ environmentId, input }))._tag === "Success",
      setIcon: (projectId, faviconPath) =>
        updateProject({ environmentId, input: { projectId, faviconPath } }),
      arrived: (projectId) =>
        waitForProject(scopeProjectRef(environmentId, projectId)).catch(() => null),
    });
    if (project === null) return false;
    const opened = await handleNewThread(scopeProjectRef(project.environmentId, project.id)).catch(
      () => null,
    );
    if (opened === null) return false;
    useComposerDraftStore.getState().setPrompt(opened.draftId, text);
    return true;
  };
}

/** The connected environments besides the primary one, by their names. */
export function useOtherMachines(): ReadonlyArray<{
  readonly environmentId: EnvironmentId;
  readonly label: string;
}> {
  const primaryId = usePrimaryEnvironmentId();
  const connected = useConnectedEnvironmentIds();
  const { environments } = useEnvironments();
  return environments
    .filter(
      (environment) =>
        environment.environmentId !== primaryId && connected.includes(environment.environmentId),
    )
    .map(({ environmentId, label }) => ({ environmentId, label }));
}

/** How often a machine's free space is read again while anything shows it. */
const MACHINE_DISK_EVERY_MS = 30_000;

/** No machine: never read. */
const NO_MACHINE = Atom.make(AsyncResult.initial());

/** Each machine's one reader, however many rows and cards show its disk. */
const readers = new Map<EnvironmentId, { count: number; readonly stop: () => void }>();

function readEvery(registry: AtomRegistry.AtomRegistry, environmentId: EnvironmentId): () => void {
  const reader = readers.get(environmentId);
  if (reader) reader.count += 1;
  else {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      registry.refresh(serverEnvironment.hostResources({ environmentId, input: {} }));
    }, MACHINE_DISK_EVERY_MS);
    readers.set(environmentId, { count: 1, stop: () => clearInterval(timer) });
  }
  return () => {
    const held = readers.get(environmentId);
    if (held === undefined) return;
    held.count -= 1;
    if (held.count > 0) return;
    held.stop();
    readers.delete(environmentId);
  };
}

/**
 * A machine's home volume, from its host resources: undefined until the
 * first answer (and for no machine), null when it gave none (an older
 * server, an unreadable volume). Read on mount and every 30 s while
 * visible, once per machine however many ask.
 */
export function useMachineDisk(
  environmentId: EnvironmentId | null,
): { readonly free: number; readonly total: number } | null | undefined {
  const registry = useContext(RegistryContext);
  const result = useAtomValue(
    environmentId === null
      ? NO_MACHINE
      : serverEnvironment.hostResources({ environmentId, input: {} }),
  );
  // oxlint-disable-next-line t3code/react-effect-budget -- Keep the machine's disk figures read on an interval while anything shows them.
  useEffect(
    () => (environmentId === null ? undefined : readEvery(registry, environmentId)),
    [registry, environmentId],
  );
  if (result._tag === "Initial") return undefined;
  // A failed refresh keeps the last figure.
  const snapshot = Option.getOrNull(AsyncResult.value(result));
  return snapshot?.diskFreeBytes === undefined || snapshot.diskTotalBytes === undefined
    ? null
    : { free: snapshot.diskFreeBytes, total: snapshot.diskTotalBytes };
}
