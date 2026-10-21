/**
 * What the composer's words do to an unsent draft, through upstream's own
 * draft store: point it at a project, the way the hero's project picker
 * does, and set its model and effort, the way the pickers do. Upstream's
 * hero and pickers then show what the words set, and its send sends it.
 * `draftWords.contract.test.ts` pins that the hero moves a draft the same
 * way.
 */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type {
  EnvironmentId,
  ModelSelection,
  ProjectId,
  ProviderInstanceId,
  ScopedProjectRef,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";

import {
  resolveComposerDraftKey,
  useComposerDraftStore,
  type ComposerThreadDraftState,
  type DraftId,
} from "../../composerDraftStore";
import { hasExplicitComposerModelSelection } from "../../lib/chatThreadActions";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProject } from "../../state/entities";
import { environmentServerConfigsAtom } from "../../state/server";

/** A draft's model as its store keeps it, to put back exactly. */
export interface DraftModelState {
  readonly activeProvider: ProviderInstanceId | null;
  readonly modelSelectionByProvider: ComposerThreadDraftState["modelSelectionByProvider"];
  readonly explicit: boolean;
}

/**
 * Calls `listener` when the draft's project or model changes, from a
 * picker, the hero or anywhere else. Returns the unsubscribe.
 */
export function subscribeDraft(draftId: string, listener: () => void): () => void {
  const read = (state: ReturnType<typeof useComposerDraftStore.getState>) => {
    const session = state.getDraftSession(draftId as DraftId);
    const draft = state.getComposerDraft(draftId as DraftId);
    return [
      session?.environmentId,
      session?.projectId,
      draft?.activeProvider,
      draft?.modelSelectionByProvider,
    ];
  };
  let last = read(useComposerDraftStore.getState());
  return useComposerDraftStore.subscribe((state) => {
    const next = read(state);
    if (next.every((value, i) => value === last[i])) return;
    last = next;
    listener();
  });
}

export function readDraftModelState(draftId: string): DraftModelState {
  const draft = useComposerDraftStore.getState().getComposerDraft(draftId as DraftId);
  return {
    activeProvider: draft?.activeProvider ?? null,
    modelSelectionByProvider: draft?.modelSelectionByProvider ?? {},
    explicit: draft?.modelSelectionExplicit === true,
  };
}

/**
 * The model the draft will run on: its own pick, else what a new chat in
 * its project starts on (`startingModel`). What an effort the words name,
 * with no model, applies to.
 */
export function readDraftModel(draftId: string): ModelSelection | null {
  const store = useComposerDraftStore.getState();
  const draft = store.getComposerDraft(draftId as DraftId);
  const active = draft?.activeProvider ?? null;
  const own = active === null ? undefined : draft?.modelSelectionByProvider[active];
  if (own) return own;
  const session = store.getDraftSession(draftId as DraftId);
  if (!session) return null;
  return startingModel(scopeProjectRef(session.environmentId, session.projectId));
}

/**
 * What a new chat in a project starts on: the project's default, else the
 * global default, else the model last used, as upstream's sticky state
 * gives a new draft.
 */
export function startingModel(projectRef: ScopedProjectRef): ModelSelection | null {
  const store = useComposerDraftStore.getState();
  const sticky =
    store.stickyActiveProvider === null
      ? null
      : (store.stickyModelSelectionByProvider[store.stickyActiveProvider] ?? null);
  return projectDefaultModel(projectRef) ?? sticky;
}

/** A project's default model: its own setting, else the global default. */
export function projectDefaultModel(projectRef: ScopedProjectRef): ModelSelection | null {
  const project = readProject(projectRef);
  const settings = appAtomRegistry
    .get(environmentServerConfigsAtom)
    .get(projectRef.environmentId)?.settings;
  return (
    (settings
      ? resolveProjectSettings(settings, projectRef.projectId, project).settings
          .defaultModelSelection
      : project?.defaultModelSelection) ?? null
  );
}

/** The project a draft will start in, as `environmentId:projectId`, now. */
export function readDraftProjectKey(draftId: string): string | null {
  const session = useComposerDraftStore.getState().getDraftSession(draftId as DraftId);
  return session ? `${session.environmentId}:${session.projectId}` : null;
}

/** Puts a draft's model back as it was before the words set it. */
export function restoreDraftModelState(draftId: string, model: DraftModelState): void {
  useComposerDraftStore.setState((state) => {
    const key = resolveComposerDraftKey(state, draftId as DraftId);
    const draft = key === null ? undefined : state.draftsByThreadKey[key];
    if (key === null || draft === undefined) return state;
    const { modelSelectionExplicit: _explicit, ...rest } = draft;
    return {
      draftsByThreadKey: {
        ...state.draftsByThreadKey,
        [key]: {
          ...rest,
          activeProvider: model.activeProvider,
          modelSelectionByProvider: model.modelSelectionByProvider,
          ...(model.explicit ? { modelSelectionExplicit: true as const } : {}),
        },
      },
    };
  });
}

/** Sets the draft's model as the model picker would, with an effort when the words name one. */
export function setDraftModel(
  draftId: string,
  instanceId: string,
  model: string,
  effort: { readonly option: string; readonly level: string } | null,
): void {
  const store = useComposerDraftStore.getState();
  const current = store.getComposerDraft(draftId as DraftId)?.modelSelectionByProvider[
    instanceId as ProviderInstanceId
  ];
  const kept = (current?.model === model ? current.options : undefined) ?? [];
  const options = effort
    ? [...kept.filter((o) => o.id !== effort.option), { id: effort.option, value: effort.level }]
    : kept;
  store.setModelSelection(
    draftId as DraftId,
    createModelSelection(instanceId as ProviderInstanceId, model, options),
    { explicit: true, replaceOptions: true },
  );
}

/** A project key, `environmentId:projectId`, as a ref. */
export function projectRefOfKey(projectKey: string): ScopedProjectRef {
  const at = projectKey.indexOf(":");
  return scopeProjectRef(
    projectKey.slice(0, at) as EnvironmentId,
    projectKey.slice(at + 1) as ProjectId,
  );
}

/** A rail key's project in the draft's environment, else its first. */
export function projectRefOf(memberKeys: ReadonlyArray<string>, environmentId: string) {
  const key = memberKeys.find((k) => k.startsWith(`${environmentId}:`)) ?? memberKeys[0];
  if (key === undefined) return null;
  const at = key.indexOf(":");
  return scopeProjectRef(key.slice(0, at) as EnvironmentId, key.slice(at + 1) as ProjectId);
}

/**
 * Points the draft at another project (`environmentId:projectId`), as the
 * hero's picker does for a draft with writing in it: the draft keeps its
 * pane, its branch and worktree reset, and unless a model was chosen, the
 * project's default model applies.
 */
export function moveDraft(draftId: string, projectKey: string): void {
  const projectRef = projectRefOfKey(projectKey);
  const store = useComposerDraftStore.getState();
  const session = store.getDraftSession(draftId as DraftId);
  if (!session) return;
  if (
    session.environmentId === projectRef.environmentId &&
    session.projectId === projectRef.projectId
  )
    return;
  store.setLogicalProjectDraftThreadId(session.logicalProjectKey, projectRef, draftId as DraftId);
  if (hasExplicitComposerModelSelection(store.getComposerDraft(draftId as DraftId))) return;
  store.applyStickyState(draftId as DraftId);
  const defaultModelSelection = projectDefaultModel(projectRef);
  if (defaultModelSelection)
    store.setModelSelection(draftId as DraftId, defaultModelSelection, { replaceOptions: true });
}

/** Whether the draft has gone: sent (promoted to a thread) or dropped. */
export function isDraftGone(draftId: string): boolean {
  const session = useComposerDraftStore.getState().getDraftSession(draftId as DraftId);
  return session === null || session.promotedTo != null;
}
