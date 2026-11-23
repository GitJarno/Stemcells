/**
 * The new Cell's workspace default, landed as upstream's new thread lands one
 * (`useHandleNewThread.ts`): its draft opens before the project's t3.json is read, and the file's
 * default lands afterwards unless the person picked a workspace or sent first. A send waits for
 * it (`substitutes/useHandleNewThread.ts`). `newCell.contract.test.ts` pins upstream's steps.
 */
import { flushSync } from "react-dom";

import {
  useComposerDraftStore,
  type DraftId,
  type DraftSessionState,
  type DraftThreadEnvMode,
} from "../../composerDraftStore";

interface ProvisionalWorkspace {
  readonly envMode: DraftThreadEnvMode;
  // A reused draft keeps an earlier "manual" marker; only a switch to manual after opening is a choice.
  readonly openedManual: boolean;
}

const pendingWorkspaceDefaults = new Map<
  DraftId,
  ProvisionalWorkspace & { readonly settled: Promise<void> }
>();

function keepsProvisionalWorkspace(
  draft: DraftSessionState | null,
  provisional: ProvisionalWorkspace,
): draft is DraftSessionState {
  return (
    draft !== null &&
    draft.promotedTo == null &&
    draft.envMode === provisional.envMode &&
    draft.worktreePath === null &&
    (provisional.openedManual || draft.environmentSelection !== "manual")
  );
}

/** What a send from `draftId` waits for, while its project file's default is still to land. */
export function readNewCellWorkspaceDefault(draftId: DraftId): Promise<void> | null {
  const pending = pendingWorkspaceDefaults.get(draftId);
  if (pending === undefined) return null;
  const draft = useComposerDraftStore.getState().getDraftSession(draftId);
  return keepsProvisionalWorkspace(draft, pending) ? pending.settled : null;
}

/**
 * Lands the env mode the project file gives (`fileEnvMode`) on the draft opened in `envMode`, and
 * its start from origin when that was still the opening one's.
 */
export function landWorkspaceDefault(input: {
  readonly draftId: DraftId;
  readonly envMode: DraftThreadEnvMode;
  readonly fileEnvMode: Promise<DraftThreadEnvMode>;
  readonly startFromOriginFor: (envMode: DraftThreadEnvMode) => boolean;
}): void {
  const { draftId, envMode, startFromOriginFor } = input;
  const { getDraftSession, setDraftThreadContext } = useComposerDraftStore.getState();
  const provisional: ProvisionalWorkspace = {
    envMode,
    openedManual: getDraftSession(draftId)?.environmentSelection === "manual",
  };
  const settled = input.fileEnvMode
    .then((fileEnvMode) => {
      const draft = getDraftSession(draftId);
      if (fileEnvMode === envMode || !keepsProvisionalWorkspace(draft, provisional)) return;
      // Commit before a waiting send re-reads the composer's workspace.
      flushSync(() =>
        setDraftThreadContext(draftId, {
          envMode: fileEnvMode,
          ...(draft.startFromOrigin === startFromOriginFor(envMode)
            ? { startFromOrigin: startFromOriginFor(fileEnvMode) }
            : {}),
        }),
      );
    })
    .finally(() => {
      if (pendingWorkspaceDefaults.get(draftId)?.settled === settled) {
        pendingWorkspaceDefaults.delete(draftId);
      }
    });
  pendingWorkspaceDefaults.set(draftId, { ...provisional, settled });
}
