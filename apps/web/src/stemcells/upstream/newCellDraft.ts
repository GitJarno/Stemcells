/**
 * The new Cell's draft, made ahead (`newCell.ts`) with no route to it, by the steps upstream's
 * "new thread" takes for a fresh draft (`useNewThreadHandler`), in the project a new tab gets: it
 * opens at once, and its project file's default lands afterwards (`workspaceDefault.ts`).
 * `newCell.contract.test.ts` pins those steps.
 */
import {
  DEFAULT_SERVER_SETTINGS,
  type ScopedProjectRef,
  type T3ProjectFile,
} from "@t3tools/contracts";
import { resolveNewThreadEnvMode, resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { resolveNewThreadModelSelection } from "@t3tools/shared/usageLimits";
import { type AnyRouter, useRouter } from "@tanstack/react-router";

import { useComposerDraftStore, type DraftThreadEnvMode } from "../../composerDraftStore";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
// Ours, as upstream's "new thread" gets it (`substitutes/plugin.ts`): this folder gets upstream's.
import {
  resolveNewDraftStartFromOrigin,
  resolveNewThreadModelSelectionOverride,
  resolveThreadActionProjectRef,
} from "./substitutes/chatThreadActions";
import { peekT3ProjectFile, readT3ProjectFile } from "../../lib/t3ProjectFileDefaults";
import { resolveProjectDefaultProviderModelSelection } from "../../providerInstances";
import { newDraftId, newThreadId } from "../../lib/utils";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProjects, readThreadShell, readThreadShells } from "../../state/entities";
import { readUnloadedThreadCount } from "../../state/olderSettledShelf";
import { environmentSummaries } from "../../state/presentation";
import { environmentServerConfigsAtom } from "../../state/server";
import { resolveThreadRouteTarget } from "../../threadRoutes";
import type { CellRef } from "../tabs/layout";
import { NEW_CELL_DRAFT_KEY } from "./newCell";
import { landWorkspaceDefault } from "./workspaceDefault";

/**
 * Makes the new Cell's draft: `project` names the project a new tab gets
 * now (`environment/project`), and `make` makes a fresh draft there, as
 * upstream's "new thread" would, without going to it. It replaces the last
 * one, which upstream drops if it was left blank.
 */
export function useNewCellDraftMaker(): {
  readonly project: string | null;
  readonly make: () => Promise<CellRef | null>;
} {
  const router = useRouter();
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread } =
    useHandleNewThread();
  const projectRef = resolveThreadActionProjectRef({
    activeDraftThread,
    activeThread: activeThread ?? undefined,
    defaultProjectRef,
    handleNewThread,
  });
  return {
    project: projectRef === null ? null : `${projectRef.environmentId}/${projectRef.projectId}`,
    make: async () => (projectRef === null ? null : makeNewCellDraft(router, projectRef)),
  };
}

/** The new Cell's fresh draft in `projectRef`, carrying the model and mode of the chat on screen. */
export function makeNewCellDraft(router: AnyRouter, projectRef: ScopedProjectRef): CellRef {
  const project = readProjects().find(
    (candidate) =>
      candidate.id === projectRef.projectId && candidate.environmentId === projectRef.environmentId,
  );
  const environmentServerConfigs = appAtomRegistry.get(environmentServerConfigsAtom);
  const serverSettings =
    environmentServerConfigs.get(projectRef.environmentId)?.settings ?? DEFAULT_SERVER_SETTINGS;
  const projectSettings = resolveProjectSettings(serverSettings, project?.id ?? null, project);
  const store = useComposerDraftStore.getState();
  // What a new thread carries over from the chat on screen: its model and its mode.
  const routeParams = router.state.matches[router.state.matches.length - 1]?.params ?? {};
  const routeTarget = resolveThreadRouteTarget(routeParams);
  const carryShell = routeTarget?.kind === "server" ? readThreadShell(routeTarget.threadRef) : null;
  const carryDraft =
    routeTarget?.kind === "draft" ? store.getDraftSession(routeTarget.draftId) : null;
  const carryComposer = routeTarget
    ? store.getComposerDraft(
        routeTarget.kind === "server" ? routeTarget.threadRef : routeTarget.draftId,
      )
    : null;
  const carryProvider = carryComposer?.activeProvider ?? null;
  const carrySelection =
    (carryProvider ? carryComposer?.modelSelectionByProvider[carryProvider] : null) ??
    carryShell?.modelSelection ??
    null;
  // As upstream's: the project's default, or its default provider's, gives way to the
  // fallback model while its provider is out of usage.
  const configuredDefaultSelection = projectSettings.settings.defaultModelSelection ?? null;
  const providers = environmentServerConfigs.get(projectRef.environmentId)?.providers ?? [];
  const fallbackResolution = resolveNewThreadModelSelection({
    defaultSelection:
      configuredDefaultSelection ??
      (carrySelection || store.stickyActiveProvider !== null
        ? null
        : resolveProjectDefaultProviderModelSelection(
            providers,
            serverSettings,
            projectRef.projectId,
          )),
    fallbackSelection: serverSettings.fallbackModelSelection ?? null,
    providers,
    settings: serverSettings,
    projectId: projectRef.projectId,
    now: Date.now(),
  });
  const projectDefaultSelection = fallbackResolution.fallback
    ? fallbackResolution.selection
    : configuredDefaultSelection;
  const carryInteractionMode =
    carryComposer?.interactionMode ??
    carryShell?.interactionMode ??
    carryDraft?.interactionMode ??
    null;
  const envModeFor = (projectFile: T3ProjectFile | null): DraftThreadEnvMode =>
    resolveNewThreadEnvMode({
      projectSettings: resolveProjectSettings(
        serverSettings,
        project?.id ?? null,
        project,
        projectFile,
      ),
      workspaceRoot: project?.workspaceRoot ?? null,
      newProjectsRoot: environmentServerConfigs.get(projectRef.environmentId)?.newProjectsRoot,
      projectHasThreads:
        readThreadShells().some(
          (thread) =>
            thread.environmentId === projectRef.environmentId &&
            thread.projectId === projectRef.projectId,
        ) ||
        readUnloadedThreadCount(
          [{ environmentId: projectRef.environmentId, id: projectRef.projectId }],
          [],
        ) > 0,
    });
  const startFromOriginFor = (envMode: DraftThreadEnvMode) =>
    resolveNewDraftStartFromOrigin({
      envMode,
      newWorktreesStartFromOrigin: projectSettings.settings.newWorktreesStartFromOrigin,
    });
  // As upstream's: the draft opens with the project file of an earlier read, or none, and the
  // file's default lands once read. An offline machine's file is never read: it never settles.
  const consultProjectFile =
    project !== undefined &&
    projectSettings.settings.defaultThreadEnvMode === null &&
    appAtomRegistry
      .get(environmentSummaries.connectedEnvironmentIdsAtom)
      .includes(project.environmentId);
  const projectFileRead = consultProjectFile
    ? readT3ProjectFile(project.environmentId, project.workspaceRoot)
    : null;
  const cachedProjectFile = consultProjectFile
    ? peekT3ProjectFile(project.environmentId, project.workspaceRoot)
    : null;
  const envMode = envModeFor(cachedProjectFile ?? null);
  const draftId = newDraftId();
  const threadId = newThreadId();
  store.setLogicalProjectDraftThreadId(NEW_CELL_DRAFT_KEY, projectRef, draftId, {
    threadId,
    createdAt: new Date().toISOString(),
    branch: null,
    worktreePath: null,
    envMode,
    startFromOrigin: startFromOriginFor(envMode),
    runtimeMode: projectSettings.settings.defaultRuntimeMode,
    ...(carryInteractionMode ? { interactionMode: carryInteractionMode } : {}),
  });
  store.applyStickyState(draftId);
  const modelSelection = resolveNewThreadModelSelectionOverride({
    projectDefaultSelection,
    carrySelection,
    carrySourceDraftId: routeTarget?.kind === "draft" ? routeTarget.draftId : null,
    destinationDraftId: draftId,
  });
  if (modelSelection) store.setModelSelection(draftId, modelSelection, { replaceOptions: true });
  if (projectFileRead !== null && cachedProjectFile === undefined) {
    landWorkspaceDefault({
      draftId,
      envMode,
      fileEnvMode: projectFileRead.then(envModeFor),
      startFromOriginFor,
    });
  }
  return { environmentId: projectRef.environmentId, threadId, draftId };
}
