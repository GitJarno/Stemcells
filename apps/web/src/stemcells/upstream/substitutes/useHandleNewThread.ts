// Replaces `hooks/useHandleNewThread.ts` (`plugin.ts`): a send from the new Cell past the last
// tab waits for its project file's workspace default (`../workspaceDefault.ts`), as a send from
// upstream's new thread does. Named re-exports: upstream's tests spy on this module, and Vitest
// can't automock an `export *`.
import type { DraftId } from "../../../composerDraftStore";
import { readPendingWorkspaceDefault as readUpstreamPending } from "../../../hooks/useHandleNewThread";
import { readNewCellWorkspaceDefault } from "../workspaceDefault";

export {
  createNewThreadHandler,
  LAST_USED_PROJECT_STORAGE_KEY,
  lastUsedProjectKeySchema,
  type NewThreadHandler,
  readLastUsedProjectKey,
  resolveDefaultProjectRef,
  useHandleNewThread,
  useNewThreadHandler,
} from "../../../hooks/useHandleNewThread";

export function readPendingWorkspaceDefault(draftId: DraftId): Promise<void> | null {
  return readUpstreamPending(draftId) ?? readNewCellWorkspaceDefault(draftId);
}
