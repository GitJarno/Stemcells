import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { availableScratchWorkspaceRoot } from "@t3tools/client-runtime/operations/projects";
import { resolveEnvironmentMachineKind, type EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useContext, useEffect } from "react";
import { AppState } from "react-native";

import { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
import { useServerConfigs } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  createNewTaskDraft,
  setComposerDraftText,
  waitForComposerDraftsLoaded,
} from "../../state/use-composer-drafts";
import { useRemoteConnectionStatus } from "../../state/use-remote-environment-registry";
import { useWorkspaceEnvironments } from "../../state/workspace";
import type { NewTaskDraftRouteParams } from "../../features/threads/thread-route-state";

// Settings › Disk on the phone reads each machine's free space from its
// server and opens a new Cell there without a project; the phone measures
// nothing itself.

export { AppText } from "../../components/ui/AppText";
export * as Dialog from "../../components/ui/Dialog";
export { ScreenScrollView } from "../../components/ui/ScreenScrollView";
export { SettingsRow } from "../../features/settings/components/SettingsRow";
export { SettingsScreen } from "../../features/settings/components/SettingsScreen";
export { SettingsSection } from "../../features/settings/components/SettingsSection";
export { openSettings } from "../../features/settings/settings-navigation";

/** Each machine the phone keeps a connection to, how that connection is now, and its icon. */
export function useMachines() {
  const environments = useWorkspaceEnvironments();
  const configs = useServerConfigs();
  return environments
    .filter((environment) => environment.isEnabled)
    .map((environment) => ({
      environmentId: environment.environmentId,
      label: environment.environmentLabel,
      connection:
        environment.connectionState === "connected"
          ? ("connected" as const)
          : environment.connectionState === "connecting" ||
              environment.connectionState === "reconnecting"
            ? ("connecting" as const)
            : ("offline" as const),
      icon: ENVIRONMENT_MACHINE_SYMBOLS[
        resolveEnvironmentMachineKind(configs.get(environment.environmentId) ?? null)
      ],
    }));
}

/** How often a machine's free space is read again while its row shows. */
const MACHINE_DISK_EVERY_MS = 30_000;

/**
 * A connected machine's home volume, from its host resources: undefined
 * until the first answer, null when it gave none (a server without the
 * fields, an unreadable volume). Read on mount and every 30 s while the app
 * is in front.
 */
export function useMachineDisk(
  environmentId: EnvironmentId,
): { readonly free: number; readonly total: number } | null | undefined {
  const registry = useContext(RegistryContext);
  const result = useAtomValue(serverEnvironment.hostResources({ environmentId, input: {} }));
  // oxlint-disable-next-line t3code/react-effect-budget -- Poll host resources every 30 s while active; stop on unmount.
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
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

/**
 * Opens a new Cell on `environmentId` without a project, in that machine's
 * folder for such Cells, with `text` waiting in the composer, unsent. Null
 * when that machine offers no Cells without a project (not connected, or a
 * server without the folder); false when it couldn't open one.
 */
export function useOpenCellWithDraft(
  environmentId: EnvironmentId,
): ((text: string) => Promise<boolean>) | null {
  const navigation = useNavigation();
  const openScratch = useAtomCommand(projectEnvironment.openScratch, { reportFailure: false });
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const serverConfig = useServerConfigs().get(environmentId);
  const environment = connectedEnvironments.find(
    (candidate) => candidate.environmentId === environmentId,
  );
  if (availableScratchWorkspaceRoot(environment?.connectionState, serverConfig) === null) {
    return null;
  }
  return async (text) => {
    try {
      await waitForComposerDraftsLoaded();
    } catch {
      return false;
    }
    const result = await openScratch({ environmentId, input: {} });
    if (result._tag !== "Success") return false;
    const project = result.value;
    const draftId = createNewTaskDraft({
      environmentId: project.environmentId,
      projectId: project.id,
    });
    setComposerDraftText(draftId, text);
    // In place of Settings, on the root stack: opened over the Settings
    // sheet, the Cell it becomes on sending would show inside that sheet.
    let root = navigation;
    for (let parent = root.getParent(); parent; parent = root.getParent()) root = parent;
    // A draft is the root's Thread route, as upstream opens one.
    const draft = {
      environmentId: String(project.environmentId),
      projectId: String(project.id),
      draftId,
      title: project.title,
    } satisfies NewTaskDraftRouteParams;
    root.dispatch(StackActions.replace("Thread", { draft }));
    return true;
  };
}
