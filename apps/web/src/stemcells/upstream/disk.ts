// What Settings › Disk takes from upstream: its settings layout and
// controls, a request to the primary environment as upstream authenticates
// one, and its new-thread flow with a draft in the composer.

import { useComposerDraftStore } from "~/composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { formatRelativeTimeLabel } from "~/timestampFormat";

export {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useRelativeTimeTick,
} from "~/components/settings/settingsLayout";
export { Badge } from "~/components/ui/badge";
export { Button } from "~/components/ui/button";
export { Spinner } from "~/components/ui/spinner";
export { toastManager } from "~/components/ui/toast";
export { formatRelativeTimeLabel };

/**
 * A GET to the primary environment's server: the session cookie in a browser
 * on its origin, the desktop app's bearer token otherwise.
 */
export async function getFromPrimary(
  pathname: string,
  searchParams?: Record<string, string>,
): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname, searchParams), {
    credentials: bearerToken ? "omit" : "include",
    headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
  });
}

/**
 * Opens a new Cell in the person's first project, as the sidebar's new-chat
 * action does, with `text` waiting in its composer, unsent. Null when there
 * is no project to open it in.
 */
export function useOpenCellWithDraft(): ((text: string) => Promise<boolean>) | null {
  const { defaultProjectRef, handleNewThread } = useHandleNewThread();
  if (defaultProjectRef === null) return null;
  return async (text) => {
    const opened = await handleNewThread(defaultProjectRef).catch(() => null);
    if (opened === null) return false;
    useComposerDraftStore.getState().setPrompt(opened.draftId, text);
    return true;
  };
}
