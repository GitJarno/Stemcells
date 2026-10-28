import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { StackActions, useNavigation } from "@react-navigation/native";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { canCreateProjectInEnvironment } from "@t3tools/client-runtime/operations/projects";
import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import { ProjectId, resolveEnvironmentMachineKind, type EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom, type AtomRegistry } from "effect/reactivity";
import { useContext, useEffect } from "react";
import { AppState } from "react-native";

import { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
import { uuidv4 } from "../../lib/uuid";
import { appAtomRegistry } from "../../state/atom-registry";
import { useServerConfigs, waitForProject } from "../../state/entities";
import { environmentProjects, projectEnvironment } from "../../state/projects";
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
import { openDiskProject } from "../../../../../stemcells/disk/project.ts";

// Settings › Disk, the home's disk plate and a Cell the full disk stopped read each machine's
// free space from its server and open a new Cell in that machine's Disk project; the phone
// measures nothing itself.

export { AppText } from "../../components/ui/AppText";
export { SymbolView } from "../../components/ui/AppSymbol";
export { Button } from "../../components/ui/Button";
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
      if (AppState.currentState !== "active") return;
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
 * the app is in front, once per machine however many ask.
 */
export function useMachineDisk(
  environmentIdText: string | null,
): { readonly free: number; readonly total: number } | null | undefined {
  const environmentId = environmentIdText as EnvironmentId | null;
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

/**
 * Opens a new Cell in `environmentId`'s Disk project, made there when the machine has none, with
 * `text` waiting in the composer, unsent. Null when that machine can't make a project now (not
 * connected, or a server without a folder for new projects); false when it couldn't open one.
 */
export function useOpenDiskCell(
  environmentIdText: string,
  /** Over the Cells it was opened from, or in Settings' place (`replace`). */
  how: "push" | "replace" = "replace",
): ((text: string) => Promise<boolean>) | null {
  const environmentId = environmentIdText as EnvironmentId;
  const navigation = useNavigation();
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const updateProject = useAtomCommand(projectEnvironment.update, { reportFailure: false });
  const { connectedEnvironments } = useRemoteConnectionStatus();
  const serverConfig = useServerConfigs().get(environmentId);
  const environment = connectedEnvironments.find(
    (candidate) => candidate.environmentId === environmentId,
  );
  const projectsRoot = canCreateProjectInEnvironment(environment?.connectionState)
    ? serverConfig?.newProjectsRoot
    : undefined;
  if (projectsRoot === undefined) return null;
  return async (text) => {
    try {
      await waitForComposerDraftsLoaded();
    } catch {
      return false;
    }
    const project = await openDiskProject(projectsRoot, {
      projectIn: (folder) =>
        findProjectByPath(
          appAtomRegistry
            .get(environmentProjects.projectsAtom)
            .filter((candidate) => candidate.environmentId === environmentId),
          folder,
        ) ?? null,
      create: async (input) => {
        const projectId = ProjectId.make(uuidv4());
        const result = await createProject({
          environmentId,
          input: { projectId, ...input, createWorkspaceRootIfMissing: true },
        });
        return result._tag === "Success" ? projectId : null;
      },
      writeFile: async (input) => (await writeFile({ environmentId, input }))._tag === "Success",
      setIcon: (projectId, faviconPath) =>
        updateProject({ environmentId, input: { projectId, faviconPath } }),
      arrived: (projectId) => waitForProject(scopeProjectRef(environmentId, projectId)),
    });
    if (project === null) return false;
    const draftId = createNewTaskDraft({
      environmentId: project.environmentId,
      projectId: project.id,
    });
    setComposerDraftText(draftId, text);
    // On the root stack: opened over the Settings sheet, the Cell it
    // becomes on sending would show inside that sheet, so it takes the
    // sheet's place; from a chat or the home, it goes over them.
    let root = navigation;
    for (let parent = root.getParent(); parent; parent = root.getParent()) root = parent;
    // A draft is the root's Thread route, as upstream opens one.
    const draft = {
      environmentId: String(project.environmentId),
      projectId: String(project.id),
      draftId,
      title: project.title,
    } satisfies NewTaskDraftRouteParams;
    root.dispatch(
      how === "replace"
        ? StackActions.replace("Thread", { draft })
        : StackActions.push("Thread", { draft }),
    );
    return true;
  };
}
