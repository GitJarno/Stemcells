/**
 * A window a move made that couldn't open: its tabs come back to the window
 * they left, rather than living on in a window no one can see.
 */
import { isAskiTab } from "../tabs/askiTab";
import type { Workspace } from "../tabs/layout";

/**
 * The workspace with `returned`'s tabs back in it, after its own (Aski's tab
 * first, as always), and the one that was active there active here.
 */
export function takeTabsBack(workspace: Workspace, returned: Workspace): Workspace {
  const here = new Set(workspace.tabs.map((tab) => tab.id));
  const back = returned.tabs.filter((tab) => !here.has(tab.id));
  if (back.length === 0) return workspace;
  const active = back.find((tab) => tab.id === returned.activeTabId) ?? back[0]!;
  const tabs = [...workspace.tabs, ...back];
  return {
    tabs: [...tabs.filter(isAskiTab), ...tabs.filter((tab) => !isAskiTab(tab))],
    activeTabId: active.id,
  };
}
