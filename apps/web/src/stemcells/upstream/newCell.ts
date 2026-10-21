/**
 * The new Cell past the last tab (`tabs/newCell.ts`), as upstream's drafts.
 * Its draft is filed under a key of its own in upstream's draft store,
 * which keeps it across reloads: the next swipe past the last tab finds it
 * there, words and all, until it is sent. `newCellDraft.ts` makes it.
 */
import {
  composerDraftHasUserContent,
  useComposerDraftStore,
  type DraftId,
} from "../../composerDraftStore";
import { readThreadShell } from "../../state/entities";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** The draft store's key for the new Cell's draft. */
export const NEW_CELL_DRAFT_KEY = "stemcells:new-cell";

/** The new Cell's draft, while there is one unsent. */
export function readNewCellDraft(): CellRef | null {
  const session = useComposerDraftStore
    .getState()
    .getDraftSessionByLogicalProjectKey(NEW_CELL_DRAFT_KEY);
  if (session === null || session.promotedTo != null) return null;
  const cell = {
    environmentId: session.environmentId,
    threadId: session.threadId,
    draftId: session.draftId,
  };
  return readThreadShell(threadRefOf(cell)) === null ? cell : null;
}

/** Whether `cell`'s draft is sent: on its way to its thread, or there. */
export function draftSent(cell: CellRef): boolean {
  if (cell.draftId === null) return true;
  const session = useComposerDraftStore.getState().getDraftSession(cell.draftId as DraftId);
  return session?.promotedTo != null || readThreadShell(threadRefOf(cell)) !== null;
}

/** Whether anything was written in `cell`'s draft. */
export function draftHasWords(cell: CellRef): boolean {
  if (cell.draftId === null) return false;
  const store = useComposerDraftStore.getState();
  return composerDraftHasUserContent(store.getComposerDraft(cell.draftId as DraftId));
}

/** The project `cell`'s draft is in (`environment/project`), while it is a draft. */
export function draftProject(cell: CellRef): string | null {
  if (cell.draftId === null) return null;
  const session = useComposerDraftStore.getState().getDraftSession(cell.draftId as DraftId);
  return session === null ? null : `${session.environmentId}/${session.projectId}`;
}

/**
 * Calls `listener` when the new Cell's draft changes: another takes its
 * key, it is sent, or it goes. Returns the unsubscribe.
 */
export function subscribeNewCellDraft(listener: () => void): () => void {
  type State = ReturnType<typeof useComposerDraftStore.getState>;
  const read = (state: State) => {
    const draftId = state.logicalProjectDraftThreadKeyByLogicalProjectKey[NEW_CELL_DRAFT_KEY];
    const draft = draftId === undefined ? undefined : state.draftThreadsByThreadKey[draftId];
    return `${draftId ?? ""} ${draft === undefined ? "gone" : draft.promotedTo == null ? "unsent" : "sent"}`;
  };
  let last = read(useComposerDraftStore.getState());
  return useComposerDraftStore.subscribe((state) => {
    const next = read(state);
    if (next === last) return;
    last = next;
    listener();
  });
}
