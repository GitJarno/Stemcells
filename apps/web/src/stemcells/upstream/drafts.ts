/** Upstream's drafts (unsent chats), as the panes that hold them. */
import { scopeProjectRef } from "@t3tools/client-runtime/environment";

import {
  composerDraftHasUserContent,
  useComposerDraftStore,
  type DraftId,
} from "../../composerDraftStore";
import { readThreadShell } from "../../state/entities";
import type { CellRef } from "../tabs/layout";
import { threadRefOf, type ThreadRouteTarget } from "./routes";

/**
 * The chat a route names. A draft resolves to the thread it becomes; null for
 * a draft this client no longer has (upstream's view then leaves the route).
 */
export function useCellForRoute(target: ThreadRouteTarget | null): CellRef | null {
  const draftId = target?.kind === "draft" ? target.draftId : null;
  const session = useComposerDraftStore((store) =>
    draftId === null ? null : store.getDraftSession(draftId),
  );
  if (target?.kind === "server") {
    return {
      environmentId: target.threadRef.environmentId,
      threadId: target.threadRef.threadId,
      draftId: null,
    };
  }
  if (draftId === null || session === null) return null;
  return { environmentId: session.environmentId, threadId: session.threadId, draftId };
}

/** Whether this client still has `draftId`'s draft: an unsent chat, or one sent but not let go. */
export function draftHeld(draftId: string): boolean {
  return useComposerDraftStore.getState().getDraftSession(draftId as DraftId) !== null;
}

const PANE_DRAFT_KEY_PREFIX = "stemcells:pane:";

/**
 * Upstream hands a project's one blank draft to every new thread there, so two new Cells in a
 * project would share it. Filing a pane's draft under the pane gives each its own; when a pane
 * takes another draft, upstream's slot rule drops the old one if it was left blank.
 */
export function fileDraftUnderPane(draftId: string, paneId: string): void {
  const store = useComposerDraftStore.getState();
  const session = store.getDraftSession(draftId as DraftId);
  if (!session || session.promotedTo != null) return;
  const key = PANE_DRAFT_KEY_PREFIX + paneId;
  if (session.logicalProjectKey === key) return;
  store.setLogicalProjectDraftThreadId(
    key,
    scopeProjectRef(session.environmentId, session.projectId),
    draftId as DraftId,
    { threadId: session.threadId },
  );
}

/** A draft no pane shows any more is dropped, unless it holds writing or was sent. */
export function dropLeftDraft(cell: CellRef): void {
  if (cell.draftId === null) return;
  const draftId = cell.draftId as DraftId;
  const store = useComposerDraftStore.getState();
  const session = store.getDraftSession(draftId);
  if (!session || session.promotedTo != null) return;
  if (readThreadShell(threadRefOf(cell)) !== null) return;
  if (composerDraftHasUserContent(store.getComposerDraft(draftId))) return;
  store.clearDraftThread(draftId);
}
