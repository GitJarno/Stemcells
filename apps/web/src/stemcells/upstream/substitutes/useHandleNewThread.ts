// Replaces `hooks/useHandleNewThread.ts` (`plugin.ts`): a send from the new Cell past the last
// tab waits for its project file's workspace default (`../workspaceDefault.ts`), as a send from
// upstream's new thread does.
import type { DraftId } from "../../../composerDraftStore";
import { readPendingWorkspaceDefault as readUpstreamPending } from "../../../hooks/useHandleNewThread";
import { readNewCellWorkspaceDefault } from "../workspaceDefault";

export * from "../../../hooks/useHandleNewThread";

export function readPendingWorkspaceDefault(draftId: DraftId): Promise<void> | null {
  return readUpstreamPending(draftId) ?? readNewCellWorkspaceDefault(draftId);
}
