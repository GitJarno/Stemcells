/**
 * The new Cell's draft, made ahead (`newCell.ts`): its page is on the strip
 * before anyone goes to it, so the draft is made with no route to it, from
 * the same steps upstream's "new thread" takes for a fresh draft
 * (`useNewThreadHandler`), in the project a new tab gets.
 * `newCell.contract.test.ts` pins those steps.
 */
import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import { resolveNewThreadEnvMode, resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useRouter } from "@tanstack/react-router";

import { useComposerDraftStore } from "../../composerDraftStore";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
// Ours, as upstream's "new thread" gets it (`substitutes/plugin.ts`): this folder gets upstream's.
import {
  resolveNewDraftStartFromOrigin,
  resolveNewThreadModelSelectionOverride,
  resolveThreadActionProjectRef,
} from "./substitutes/chatThreadActions";
import { readT3ProjectFile } from "../../lib/t3ProjectFileDefaults";
import { newDraftId, newThreadId } from "../../lib/utils";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProjects, readThreadShell, readThreadShells } from "../../state/entities";
import { environmentSummaries } from "../../state/presentation";
import { environmentServerConfigsAtom } from "../../state/server";
import { resolveThreadRouteTarget } from "../../threadRoutes";
import type { CellRef } from "../tabs/layout";
import { NEW_CELL_DRAFT_KEY } from "./newCell";

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
  const make = async (): Promise<CellRef | null> => {
    if (projectRef === null) return null;
    const project = readProjects().find(
      (candidate) =>
        candidate.id === projectRef.projectId &&
        candidate.environmentId === projectRef.environmentId,
    );
    const environmentServerConfigs = appAtomRegistry.get(environmentServerConfigsAtom);
    const serverSettings =
      environmentServerConfigs.get(projectRef.environmentId)?.settings ?? DEFAULT_SERVER_SETTINGS;
    const projectSettings = resolveProjectSettings(serverSettings, project?.id ?? null, project);
    const store = useComposerDraftStore.getState();
    // What a new thread carries over from the chat on screen: its model and its mode.
    const routeParams = router.state.matches[router.state.matches.length - 1]?.params ?? {};
    const routeTarget = resolveThreadRouteTarget(routeParams);
    const carryShell =
      routeTarget?.kind === "server" ? readThreadShell(routeTarget.threadRef) : null;
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
    const carryInteractionMode =
      carryComposer?.interactionMode ??
      carryShell?.interactionMode ??
      carryDraft?.interactionMode ??
      null;
    // As upstream's (#23967): reading the project file of a machine that's
    // offline never settles, and the draft would never be made.
    const consultProjectFile =
      project !== undefined &&
      projectSettings.settings.defaultThreadEnvMode === null &&
      appAtomRegistry
        .get(environmentSummaries.connectedEnvironmentIdsAtom)
        .includes(project.environmentId);
    const projectFile = consultProjectFile
      ? await readT3ProjectFile(project.environmentId, project.workspaceRoot)
      : null;
    const envMode = resolveNewThreadEnvMode({
      projectSettings: resolveProjectSettings(
        serverSettings,
        project?.id ?? null,
        project,
        projectFile,
      ),
      workspaceRoot: project?.workspaceRoot ?? null,
      newProjectsRoot: environmentServerConfigs.get(projectRef.environmentId)?.newProjectsRoot,
      projectHasThreads: readThreadShells().some(
        (thread) =>
          thread.environmentId === projectRef.environmentId &&
          thread.projectId === projectRef.projectId,
      ),
    });
    const draftId = newDraftId();
    const threadId = newThreadId();
    const latest = useComposerDraftStore.getState();
    latest.setLogicalProjectDraftThreadId(NEW_CELL_DRAFT_KEY, projectRef, draftId, {
      threadId,
      createdAt: new Date().toISOString(),
      branch: null,
      worktreePath: null,
      envMode,
      startFromOrigin: resolveNewDraftStartFromOrigin({
        envMode,
        newWorktreesStartFromOrigin: projectSettings.settings.newWorktreesStartFromOrigin,
      }),
      runtimeMode: projectSettings.settings.defaultRuntimeMode,
      ...(carryInteractionMode ? { interactionMode: carryInteractionMode } : {}),
    });
    latest.applyStickyState(draftId);
    const modelSelection = resolveNewThreadModelSelectionOverride({
      projectDefaultSelection: projectSettings.settings.defaultModelSelection ?? null,
      carrySelection,
      carrySourceDraftId: routeTarget?.kind === "draft" ? routeTarget.draftId : null,
      destinationDraftId: draftId,
    });
    if (modelSelection) latest.setModelSelection(draftId, modelSelection, { replaceOptions: true });
    return { environmentId: projectRef.environmentId, threadId, draftId };
  };
  return {
    project: projectRef === null ? null : `${projectRef.environmentId}/${projectRef.projectId}`,
    make,
  };
}
