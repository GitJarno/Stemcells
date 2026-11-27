// A plan's Cell as the phone starts it (stemcells/tasks/aski-orchestrator.md, decisions 5 and
// 6): the thread the plan minted, in the act's project at its root, told the person's own words
// (`messageOf`), on the model the act names or else the project's own, in the person's default
// modes. Never a worktree, and never more access than the person's default gives.

import { clampEffort } from "../../../../../../stemcells/orchestrator/names.ts";
import {
  messageOf,
  type ModelEntry,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import {
  buildProjectThreadStartTurnInput,
  createModelSelection,
  type ModelSelection,
  ProjectId,
  ProviderInstanceId,
  type ProviderInteractionMode,
  type RuntimeMode,
} from "../../upstream/planLaunch";

export interface LaunchSetup {
  readonly projectId: string;
  /** As the sidebar writes it, for the words of a failure. */
  readonly projectName: string;
  readonly projectCwd: string;
  /** The project's default model, else the app's; null when the machine offers neither. */
  readonly defaultModel: ModelSelection | null;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
  /** The machine's models, for a default model's effort ladder. */
  readonly models: ReadonlyArray<ModelEntry>;
  /** Whether a provider instance can start a Cell now. */
  readonly ready: (instanceId: string) => boolean;
  readonly commandId: string;
  readonly messageId: string;
  /** An ISO time. */
  readonly createdAt: string;
}

export type Launch =
  | { readonly ok: true; readonly input: ReturnType<typeof buildProjectThreadStartTurnInput> }
  | { readonly ok: false; readonly reason: string };

/**
 * The model an act's Cell runs on: the one Aski's chat named whole, as given; else the one the
 * person said, at the effort they said; else the default, at the effort they said when its
 * ladder has one near.
 */
export function selectionOf(
  act: Pick<StartAct, "selection" | "model" | "effort">,
  setup: Pick<LaunchSetup, "defaultModel" | "models">,
): ModelSelection | null {
  if (act.selection !== undefined)
    return createModelSelection(
      ProviderInstanceId.make(act.selection.instanceId),
      act.selection.model,
      act.selection.options ?? [],
    );
  if (act.model !== null)
    return createModelSelection(
      ProviderInstanceId.make(act.model.instanceId),
      act.model.id,
      act.model.effort === null
        ? []
        : [{ id: act.model.effort.option, value: act.model.effort.level }],
    );
  const fallback = setup.defaultModel;
  if (fallback === null || act.effort === null) return fallback;
  const entry = setup.models.find(
    (model) => model.instanceId === fallback.instanceId && model.id === fallback.model,
  );
  const level = entry === undefined ? null : clampEffort(act.effort, entry.efforts);
  if (entry?.effortOption === undefined || level === null) return fallback;
  const option = entry.effortOption;
  return createModelSelection(fallback.instanceId, fallback.model, [
    ...(fallback.options ?? []).filter((one) => one.id !== option),
    { id: option, value: level },
  ]);
}

/** What starts `act`'s Cell, or why it can't start. */
export function launchOf(act: StartAct, setup: LaunchSetup): Launch {
  const selection = selectionOf(act, setup);
  if (selection === null)
    return { ok: false, reason: `No model to start a Cell in ${setup.projectName} on.` };
  if (!setup.ready(selection.instanceId))
    return { ok: false, reason: `${selection.model} can’t start now.` };
  return {
    ok: true,
    input: buildProjectThreadStartTurnInput({
      projectId: ProjectId.make(setup.projectId),
      projectCwd: setup.projectCwd,
      threadId: act.threadId,
      commandId: setup.commandId,
      messageId: setup.messageId,
      createdAt: setup.createdAt,
      text: messageOf(act),
      titleText: act.title,
      uploadedAttachments: [],
      modelSelection: selection,
      runtimeMode: setup.runtimeMode,
      interactionMode: setup.interactionMode,
      workspaceMode: "local",
      branch: null,
      worktreePath: null,
      startFromOrigin: false,
      worktreeBranchName: "",
    }),
  };
}
