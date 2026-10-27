// What the phone's home takes from upstream's: its segmented control (the
// tabs), how it opens a chat, which column it stands in, and whether it
// stands in the workspace (where its list has a header).

import { useSelectWorkspaceDetail } from "../../features/workspace/useSelectWorkspaceDetail";

export { SegmentedControl } from "../../components/ui/SegmentedControl";
export { useWorkspaceTabs } from "../../features/workspace/WorkspaceTabsContext";
export { NativePrimaryColumnContext } from "../../native/v5-workspace-context";

/** Opens a chat as upstream's home opens a thread (`HomeRouteScreen.tsx`). */
export function useHomeThreadSelection() {
  const selectDetail = useSelectWorkspaceDetail();
  return (thread: { readonly environmentId: string; readonly id: string }) =>
    selectDetail({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
}
