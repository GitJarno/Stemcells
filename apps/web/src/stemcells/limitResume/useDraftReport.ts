import { useEffect } from "react";

import { randomUUID } from "../upstream/ui";
import { draftedThreadIds, onDraftsChange, postToPrimary } from "../upstream/limitResume";
import { DRAFTS_PATH, startDraftReport } from "./drafts";

/**
 * Reports this screen's drafts to this Mac's server for as long as the app
 * is open (`drafts.ts`), on every page: `DraftReport` calls it beside the
 * sidebar, so leaving the chat for Settings, Usage, a project or the welcome
 * page, in any layout, keeps a draft holding its Cell.
 */
export function useDraftReport() {
  // oxlint-disable-next-line t3code/react-effect-budget -- Report this screen's drafts to the server while mounted, and stop the report on unmount.
  useEffect(() => {
    const screen = randomUUID();
    return startDraftReport({
      read: draftedThreadIds,
      onChange: onDraftsChange,
      post: async (threadIds) => {
        const response = await postToPrimary(DRAFTS_PATH, { screen, threadIds });
        if (!response.ok) throw new Error(`drafts: ${response.status}`);
      },
    });
  }, []);
}
