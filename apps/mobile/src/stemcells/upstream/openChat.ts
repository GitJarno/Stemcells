// What Input's loop (`inbox/useInbox.ts`) takes from upstream's workspace: which chat is open and
// whether it stands beside the home. Apart from `home.ts`, which the picks import, so upstream's
// navigation never joins that import chain.

import { useNavigationState } from "@react-navigation/native";
import { use } from "react";

import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import { workspaceRoutesOf } from "../../features/layout/workspace-overlay-routes";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";

/**
 * The chat the workspace shows, beside the home or over it, as `environmentId:threadId`; null for
 * none, a draft, or another page. A sheet over the chat leaves it open.
 */
export function useOpenChat(): string | null {
  return useNavigationState((state) => {
    const { workspace } = workspaceRoutesOf(state.routes.slice(0, state.index + 1));
    const top = workspace.at(-1);
    const params = top?.name === "Thread" ? (top.params as Record<string, unknown>) : undefined;
    const { environmentId, threadId } = params ?? {};
    return typeof environmentId === "string" && typeof threadId === "string"
      ? `${environmentId}:${threadId}`
      : null;
  });
}

/** Whether a chat opened from the home stands beside it (an iPad's, the unfolded Duo's columns). */
export function useChatBeside(): boolean {
  const { layout } = useAdaptiveWorkspaceLayout();
  return layout.usesSplitView && use(NativePrimaryColumnContext) !== null;
}
