// What Settings › Disk takes from upstream: its settings layout and
// controls, a request to the primary environment as upstream authenticates
// one, the connected environments and each one's host resources, and its
// new-thread flow with a draft in the composer.

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ProjectId, ScopedProjectRef } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { useProjects } from "~/state/entities";
import {
  useConnectedEnvironmentIds,
  useEnvironments,
  usePrimaryEnvironmentId,
} from "~/state/environments";
import { serverEnvironment } from "~/state/server";
import { formatRelativeTimeLabel } from "~/timestampFormat";

export type { EnvironmentId };
export { usePrimaryEnvironmentId };

export {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useRelativeTimeTick,
} from "~/components/settings/settingsLayout";
export { Badge } from "~/components/ui/badge";
export { Button } from "~/components/ui/button";
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

/**
 * Where a Cell on `environmentId` opens: the person's first project when it
 * is there, else the first project there, never one elsewhere, since the
 * Cell frees the disk of the machine it runs on.
 */
export function projectRefOn(
  environmentId: EnvironmentId | null,
  defaultProjectRef: ScopedProjectRef | null,
  projects: ReadonlyArray<{ readonly environmentId: EnvironmentId; readonly id: ProjectId }>,
): ScopedProjectRef | null {
  if (environmentId === null) return null;
  if (defaultProjectRef?.environmentId === environmentId) return defaultProjectRef;
  const project = projects.find((candidate) => candidate.environmentId === environmentId);
  return project ? scopeProjectRef(project.environmentId, project.id) : null;
}

/**
 * Opens a new Cell on `environmentId`, in the person's first project when
 * it is there, else in the first project there, with `text` waiting in its
 * composer, unsent. Null when that environment has no project.
 */
export function useOpenCellWithDraft(
  environmentId: EnvironmentId | null,
): ((text: string) => Promise<boolean>) | null {
  const { defaultProjectRef, handleNewThread } = useHandleNewThread();
  const projectRef = projectRefOn(environmentId, defaultProjectRef, useProjects());
  if (projectRef === null) return null;
  return async (text) => {
    const opened = await handleNewThread(projectRef).catch(() => null);
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

/** How often a machine's free space is read again while its row shows. */
const MACHINE_DISK_EVERY_MS = 30_000;

/**
 * An environment's home volume, from its host resources: undefined until
 * the first answer, null when it gave none (an older server, an unreadable
 * volume, no answer yet that succeeded). Read on mount and every 30 s while
 * visible.
 */
export function useMachineDisk(
  environmentId: EnvironmentId,
): { readonly free: number; readonly total: number } | null | undefined {
  const registry = useContext(RegistryContext);
  const result = useAtomValue(serverEnvironment.hostResources({ environmentId, input: {} }));
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      registry.refresh(serverEnvironment.hostResources({ environmentId, input: {} }));
    }, MACHINE_DISK_EVERY_MS);
    return () => clearInterval(timer);
  }, [registry, environmentId]);
  if (result._tag === "Initial") return undefined;
  // A failed refresh keeps the last figure.
  const snapshot = Option.getOrNull(AsyncResult.value(result));
  return snapshot?.diskFreeBytes === undefined || snapshot.diskTotalBytes === undefined
    ? null
    : { free: snapshot.diskFreeBytes, total: snapshot.diskTotalBytes };
}
