// What the phone's home takes from upstream's: its segmented control (the
// tabs), how it opens a chat, which column it stands in, whether it stands
// in the workspace (where its list has a header), the header's items, and the
// machines and projects its list is narrowed to.

import { useAtomValue } from "@effect/atom-react";

import { useSelectWorkspaceDetail } from "../../features/workspace/useSelectWorkspaceDetail";
import { threadListEnvironmentsAtom } from "../../state/server";

export type { EnvironmentMachineKind } from "@t3tools/contracts";

export { SegmentedControl } from "../../components/ui/SegmentedControl";
export { useWorkspaceTabs } from "../../features/workspace/WorkspaceTabsContext";
export { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
export { Toolbar } from "../../components/ui/Toolbar";
export { Menu } from "../../components/ui/Menu";
export { SymbolView } from "../../components/ui/AppSymbol";
export { ProjectFavicon } from "../../components/ProjectFavicon";
export { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
export { useProjects } from "../../state/entities";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { useHomeListOptions } from "../../features/home/home-list-options";

/** A transparent header with nothing behind it: iOS 27's `automatic` edge is a hard band. */
export const NO_HEADER_BAND = {
  top: "hidden",
  bottom: "hidden",
  left: "hidden",
  right: "hidden",
} as const;

/** Each environment's kind of machine, where it says. */
export function useMachineKinds() {
  return useAtomValue(threadListEnvironmentsAtom).machineByEnvironmentId;
}

/** Opens a chat as upstream's home opens a thread (`HomeRouteScreen.tsx`). */
export function useHomeThreadSelection() {
  const selectDetail = useSelectWorkspaceDetail();
  return (thread: { readonly environmentId: string; readonly id: string }) =>
    selectDetail({
      name: "Thread",
      params: { environmentId: String(thread.environmentId), threadId: String(thread.id) },
    });
}
