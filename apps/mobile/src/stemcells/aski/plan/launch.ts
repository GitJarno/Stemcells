// A plan's Cell as the phone starts it (stemcells/tasks/aski-orchestrator.md, decisions 5, 6,
// 16, 17): the plan's thread, at the project's root, told the person's own words, on the act's
// model or the project's own, in the person's default modes and with no more access. A Cell in
// a worktree, or after others, is the server's to start, handed the same model and modes.

import { clampEffort } from "../../../../../../stemcells/orchestrator/names.ts";
import {
  messageOf,
  type ModelEntry,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import type { QueueRequest } from "../../../../../../stemcells/orchestrator/wire.ts";
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

/** The model `act`'s Cell runs on, when it can start a Cell now; else why not. */
function chosenOf(
  act: StartAct,
  setup: Pick<LaunchSetup, "projectName" | "defaultModel" | "models" | "ready">,
):
  | { readonly ok: true; readonly selection: ModelSelection }
  | { readonly ok: false; readonly reason: string } {
  const selection = selectionOf(act, setup);
  if (selection === null)
    return { ok: false, reason: `No model to start a Cell in ${setup.projectName} on.` };
  if (!setup.ready(selection.instanceId)) {
    const name =
      setup.models.find(
        (model) => model.instanceId === selection.instanceId && model.id === selection.model,
      )?.name ?? selection.model;
    return { ok: false, reason: `${name} can’t start now.` };
  }
  return { ok: true, selection };
}

/** What starts `act`'s Cell, or why it can't start. */
export function launchOf(act: StartAct, setup: LaunchSetup): Launch {
  const chosen = chosenOf(act, setup);
  if (!chosen.ok) return chosen;
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
      modelSelection: chosen.selection,
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

/** Whether `act`'s Cell works in a worktree of its own: the person's word, else the project's default. */
export const worksApart = (act: Pick<StartAct, "apart">, byDefault: boolean): boolean =>
  act.apart ?? byDefault;

/** What hands `act`'s Cell to the server to start, with what a start here would use. */
export function queueOf(
  planId: string,
  act: StartAct,
  setup: Pick<
    LaunchSetup,
    | "projectId"
    | "projectName"
    | "defaultModel"
    | "models"
    | "ready"
    | "runtimeMode"
    | "interactionMode"
  > & {
    /** The project starts its Cells in worktrees of their own. */
    readonly apart: boolean;
  },
):
  | { readonly ok: true; readonly request: QueueRequest }
  | { readonly ok: false; readonly reason: string } {
  const chosen = chosenOf(act, setup);
  if (!chosen.ok) return chosen;
  return {
    ok: true,
    request: {
      id: planId,
      i: act.i,
      projectId: setup.projectId,
      modelSelection: chosen.selection,
      runtimeMode: setup.runtimeMode,
      interactionMode: setup.interactionMode,
      worktree: worksApart(act, setup.apart),
    },
  };
}
