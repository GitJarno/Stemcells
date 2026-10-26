import { type ComponentProps, useEffect, useSyncExternalStore } from "react";

import { focusedPane } from "../tabs/layout";
import { useWorkspaceStore } from "../tabs/store";
import { useChatWorking } from "../upstream/status";
import { UpstreamHostedBrowserWebview, useBrowserWanted } from "../upstream/surfaces";
import { useCellPanelOnBrowser } from "../upstream/workbench";
import { browserAwake, subscribeToWakes, wakeBrowser, wakes } from "./awake";

/**
 * Upstream's desktop browser, hosted only while it is awake (`awake.ts`).
 * Asleep, it has no webview: nothing of it loads or runs.
 */
export function HostedBrowserWebview(props: ComponentProps<typeof UpstreamHostedBrowserWebview>) {
  const { runtimeTabId, threadRef } = props;
  // Its Cell's Surface on stage shows a browser: an empty one waits on it to
  // load what the person types, before a slot ever claims it.
  const onStage = useWorkspaceStore((store) => {
    const cell = focusedPane(store.workspace)?.cell ?? null;
    return cell?.environmentId === threadRef.environmentId && cell.threadId === threadRef.threadId
      ? cell
      : null;
  });
  const shown = useCellPanelOnBrowser(onStage);
  const working = useChatWorking(threadRef);
  const wanted = useBrowserWanted(runtimeTabId) || shown || working;
  useSyncExternalStore(subscribeToWakes, wakes, wakes);
  // oxlint-disable-next-line t3code/react-effect-budget -- Wake the desktop browser in the shared wake store once it is shown, busy or its Cell works.
  useEffect(() => {
    if (wanted) wakeBrowser(runtimeTabId);
  }, [runtimeTabId, wanted]);
  return browserAwake(runtimeTabId, wanted) ? <UpstreamHostedBrowserWebview {...props} /> : null;
}
