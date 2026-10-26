// What Settings › Disk takes from upstream: its settings layout and
// controls, a request to the primary environment as upstream authenticates
// one, the connected environments and each one's host resources, and its
// way to open a Cell without a project, with a draft in the composer.

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { availableScratchWorkspaceRoot } from "@t3tools/client-runtime/operations/projects";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useContext, useEffect } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import {
  useConnectedEnvironmentIds,
  useEnvironments,
  usePrimaryEnvironmentId,
} from "~/state/environments";
import { projectEnvironment } from "~/state/projects";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";
import { formatRelativeTimeLabel } from "~/timestampFormat";

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
 * Opens a new Cell on `environmentId` without a project, in that machine's
 * folder for such Cells, with `text` waiting in its composer, unsent. Null
 * when that machine offers no Cells without a project (not connected, or a
 * server without the folder).
 */
export function useOpenCellWithDraft(
  environmentId: EnvironmentId | null,
): ((text: string) => Promise<boolean>) | null {
  const { environments } = useEnvironments();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, { reportFailure: false });
  const handleNewThread = useNewThreadHandler();
  const environment = environments.find((entry) => entry.environmentId === environmentId);
  if (
    environmentId === null ||
    availableScratchWorkspaceRoot(environment?.connection.phase, environment?.serverConfig) === null
  ) {
    return null;
  }
  return async (text) => {
    const result = await openScratch({ environmentId, input: {} });
    if (result._tag !== "Success") return false;
    const opened = await handleNewThread(
      scopeProjectRef(result.value.environmentId, result.value.id),
    ).catch(() => null);
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
  // oxlint-disable-next-line t3code/react-effect-budget -- Refresh the machine's disk figures on an interval while the page is visible, and clear it on unmount.
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
