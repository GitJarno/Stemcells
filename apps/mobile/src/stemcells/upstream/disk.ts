import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { resolveEnvironmentMachineKind, type EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useContext, useEffect } from "react";
import { AppState } from "react-native";

import { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
import { useProjects, useServerConfigs } from "../../state/entities";
import { serverEnvironment } from "../../state/server";
import {
  createNewTaskDraft,
  setComposerDraftText,
  updateComposerDraftSettings,
  waitForComposerDraftsLoaded,
} from "../../state/use-composer-drafts";
import { useWorkspaceEnvironments } from "../../state/workspace";
import { projectOn } from "../disk/machineProject";

// Settings › Disk on the phone reads each machine's free space from its
// server and opens a new Cell there; the phone measures nothing itself.

export { AppText } from "../../components/ui/AppText";
export * as Dialog from "../../components/ui/Dialog";
export { ScreenScrollView } from "../../components/ui/ScreenScrollView";
export { SettingsRow } from "../../features/settings/components/SettingsRow";
export { SettingsScreen } from "../../features/settings/components/SettingsScreen";
export { SettingsSection } from "../../features/settings/components/SettingsSection";

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
 * Opens a new Cell on `environmentId`, in its first project's folder, with
 * `text` waiting in the composer, unsent. Null when that machine has no
 * project; false when the drafts couldn't load.
 */
export function useOpenCellWithDraft(
  environmentId: EnvironmentId,
): ((text: string) => Promise<boolean>) | null {
  const navigation = useNavigation();
  const project = projectOn(environmentId, useProjects());
  if (project === null) return null;
  return async (text) => {
    try {
      await waitForComposerDraftsLoaded();
    } catch {
      return false;
    }
    const draftId = createNewTaskDraft({
      environmentId: project.environmentId,
      projectId: project.id,
    });
    setComposerDraftText(draftId, text);
    // In the project folder itself: a new worktree on a full disk copies the
    // checkout and runs its setup, an install, before the Cell frees a byte.
    updateComposerDraftSettings(draftId, {
      workspaceSelection: { mode: "local", branch: null, worktreePath: null },
    });
    // In place of Settings, on the root stack: opened over the Settings
    // sheet, the Cell it becomes on sending would show inside that sheet.
    let root = navigation;
    for (let parent = root.getParent(); parent; parent = root.getParent()) root = parent;
    root.dispatch(
      StackActions.replace("NewTaskSheet", {
        screen: "NewTaskDraft",
        params: {
          environmentId: String(project.environmentId),
          projectId: String(project.id),
          draftId,
          title: project.title,
        },
      }),
    );
    return true;
  };
}
