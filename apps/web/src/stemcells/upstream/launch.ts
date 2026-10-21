/**
 * Starts the Cells a message's words set up beside the draft's own, the way
 * upstream starts each thread of a multiple-model send: one call per Cell
 * creates the thread with its project, model, modes and first message
 * (`orchestration.launchThread`, under `startTurn`). Each Cell runs with
 * the draft's modes, so a Cell started this way never gets more access
 * than the draft would have. `launch.contract.test.ts` pins what this
 * follows.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { deriveThreadTitleSeed } from "@t3tools/client-runtime/operations";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  type EnvironmentId,
  isProviderAvailable,
  type ModelSelection,
  type ProviderInstanceId,
  type ProviderInteractionMode,
  type RuntimeMode,
  type ThreadId,
} from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  createModelSelection,
  resolvePromptInjectedEffort,
} from "@t3tools/shared/model";

import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import { toastManager } from "../../components/ui/toast";
import { hasExplicitComposerModelSelection } from "../../lib/chatThreadActions";
import { newMessageId, newThreadId } from "../../lib/utils";
import { getProviderModelCapabilities } from "../../providerModels";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { readProject, readThreadShell, waitForThreadShell } from "../../state/entities";
import { environmentPresentations } from "../../state/presentation";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import type { CellRef } from "../tabs/layout";
import type { Carry } from "./carry";
import { projectRefOfKey, readDraftModel, startingModel } from "./draftWords";

/** What the Cells beside a draft take from it. */
export interface DraftSetup {
  readonly environmentId: string;
  readonly projectId: string;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
  /** The draft's own pick, which a Cell its words give no model runs on. */
  readonly pick: ModelSelection | null;
  /**
   * The model the draft runs on, as far as the store says; once the draft
   * is sent, what its thread runs on (`withSentModel`). A Cell's last
   * resort when nothing else names one.
   */
  readonly current: ModelSelection | null;
  /** The draft's branch, and whether it starts in a new worktree. */
  readonly branch: string | null;
  readonly worktree: boolean;
  readonly startFromOrigin: boolean;
}

export function readDraftSetup(draftId: string): DraftSetup | null {
  const store = useComposerDraftStore.getState();
  const session = store.getDraftSession(draftId as DraftId);
  if (!session) return null;
  const draft = store.getComposerDraft(draftId as DraftId);
  const active = draft?.activeProvider ?? null;
  return {
    environmentId: session.environmentId,
    projectId: session.projectId,
    runtimeMode: session.runtimeMode,
    interactionMode: session.interactionMode,
    pick:
      hasExplicitComposerModelSelection(draft) && active !== null
        ? (draft?.modelSelectionByProvider[active] ?? null)
        : null,
    current: readDraftModel(draftId),
    branch: session.branch,
    worktree: session.envMode === "worktree",
    startFromOrigin: session.startFromOrigin,
  };
}

/**
 * One Cell to start: where, on what, and its message. With no model, it
 * runs on the draft's pick, else its project's default, else what the
 * draft runs on.
 */
export interface CellStart {
  /** `environmentId:projectId`. */
  readonly projectKey: string;
  readonly model: {
    readonly instanceId: string;
    readonly model: string;
    readonly effort: { readonly option: string; readonly level: string } | null;
  } | null;
  readonly text: string;
}

export type CellStarted =
  | { readonly ok: true; readonly cell: CellRef }
  | { readonly ok: false; readonly error: string };

/**
 * Starts Cells beside a draft; each settles on its own. Each takes what
 * the draft's message carried besides its words (`carry.ts`).
 */
export function useStartCells(): (
  setup: DraftSetup,
  cells: ReadonlyArray<CellStart>,
  carry: Carry | null,
) => Promise<CellStarted[]> {
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  return (setup, cells, carry) =>
    Promise.all(
      cells.map(async (cell): Promise<CellStarted> => {
        const projectRef = projectRefOfKey(cell.projectKey);
        const { environmentId, projectId } = projectRef;
        const project = readProject(projectRef);
        if (!project) return { ok: false, error: "That project isn't here any more." };
        const selection = cell.model
          ? createModelSelection(
              cell.model.instanceId as ProviderInstanceId,
              cell.model.model,
              cell.model.effort
                ? [{ id: cell.model.effort.option, value: cell.model.effort.level }]
                : [],
            )
          : (setup.pick ?? startingModel(projectRef) ?? setup.current);
        if (!selection)
          return { ok: false, error: `No model to start a Cell in ${project.title} on.` };
        const provider = appAtomRegistry
          .get(environmentPresentations.providersByEnvironmentAtom)
          .get(environmentId)
          ?.find((p) => p.instanceId === selection.instanceId);
        if (!provider?.enabled || !isProviderAvailable(provider) || provider.status !== "ready")
          return { ok: false, error: `${selection.model} can't start now.` };

        // An effort the provider reads from the prompt goes at its head, as upstream's send puts it.
        const caps = getProviderModelCapabilities(
          provider.models,
          selection.model,
          provider.driver,
        );
        const injected =
          selection.options
            ?.map((option) => resolvePromptInjectedEffort(caps, String(option.value)))
            .find((effort) => effort !== null) ?? null;
        const text = applyClaudePromptEffortPrefix(cell.text, injected);
        const carried = carry ? await carry.to(environmentId, text) : null;
        if (carried && !carried.ok) return { ok: false, error: carried.error };

        // Only the draft's own project has the branch the draft names.
        const own = environmentId === setup.environmentId && projectId === setup.projectId;
        const branch = own ? setup.branch : null;
        const worktree = own && setup.worktree && branch !== null;
        const title = deriveThreadTitleSeed({
          text: cell.text,
          attachments: carry?.attachments ?? [],
        });
        const threadId = newThreadId();
        const createdAt = new Date().toISOString();
        const result = await startTurn({
          environmentId,
          input: {
            threadId,
            message: {
              messageId: newMessageId(),
              role: "user",
              text: carried?.text ?? text,
              attachments: carried?.attachments ?? [],
              ...(carried?.context ? { context: carried.context } : {}),
            },
            modelSelection: selection,
            titleSeed: title,
            runtimeMode: setup.runtimeMode,
            interactionMode: setup.interactionMode,
            bootstrap: {
              createThread: {
                projectId,
                title,
                modelSelection: selection,
                runtimeMode: setup.runtimeMode,
                interactionMode: setup.interactionMode,
                branch,
                worktreePath: null,
                createdAt,
              },
              ...(worktree
                ? {
                    prepareWorktree: {
                      projectCwd: project.workspaceRoot,
                      baseBranch: branch,
                      ...(setup.startFromOrigin ? { startFromOrigin: true } : {}),
                    },
                    runSetupScript: true,
                  }
                : {}),
            },
            createdAt,
          },
        });
        if (result._tag === "Failure") {
          const error = squashAtomCommandFailure(result);
          return {
            ok: false,
            error: error instanceof Error ? error.message : "The Cell didn't start.",
          };
        }
        return { ok: true, cell: { environmentId, threadId, draftId: null } };
      }),
    );
}

/** Says which Cells didn't start, and why, the way upstream reports a failed send. */
export function reportUnstarted(started: ReadonlyArray<CellStarted>): void {
  const failed = started.flatMap((s) => (s.ok ? [] : [s.error]));
  if (failed.length === 0) return;
  toastManager.add({
    type: "error",
    title: failed.length === 1 ? "A Cell didn't start" : `${failed.length} Cells didn't start`,
    description: [...new Set(failed)].join(" "),
  });
}

/** The setup with the model the draft's own Cell was sent on, once upstream made it a thread. */
export async function withSentModel(setup: DraftSetup, sent: CellRef): Promise<DraftSetup> {
  const ref = scopeThreadRef(sent.environmentId as EnvironmentId, sent.threadId as ThreadId);
  await waitForThreadShell(ref);
  return { ...setup, current: readThreadShell(ref)?.modelSelection ?? setup.current };
}
