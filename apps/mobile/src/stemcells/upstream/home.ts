// What the phone's home takes from upstream's: its tabs, how it opens a chat and comes back, its
// column, whether it stands in the workspace, the inset its list rests under, the header's items,
// the machines and projects in view, the older settled chats the servers keep, where the phone
// keeps its picks, and when a row starts to leave. Where its foot stands: `overSearch.ts`.

import { useAtomValue } from "@effect/atom-react";
import { createContext, use } from "react";
import { Keyboard, useWindowDimensions } from "react-native";

import { PaneContext } from "../../components/ui/Pane";
import { useBarInset } from "../../components/ui/useBarInset";
import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import { useWorkspaceTabs } from "../../features/layout/workspace/WorkspaceTabsContext";
import { useSelectWorkspaceDetail } from "../../features/layout/workspace/useSelectWorkspaceDetail";
import { isDuoDevice } from "../../lib/device-type";
import { useDeviceType } from "../../native/native-layout-metrics";
import { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
import { threadListEnvironmentsAtom } from "../../state/presentation";

export type { EnvironmentMachineKind } from "@t3tools/contracts";

export { SegmentedControl } from "../../components/ui/SegmentedControl";
export { useContentTopInset } from "../../components/ui/useBarInset";
export { useAppearancePreferences } from "../../features/settings/appearance/AppearancePreferencesProvider";
export {
  useWorkspaceTabs,
  WorkspaceTabsContext,
} from "../../features/layout/workspace/WorkspaceTabsContext";
export { useOlderSettledShelf } from "../../state/olderSettledShelf";
export type { OlderSettledScope } from "@t3tools/client-runtime/state/threads";
export { Toolbar } from "../../components/ui/Toolbar";
export { Menu } from "../../components/ui/Menu";
export { SymbolView } from "../../components/ui/AppSymbol";
export { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
export { useProjects } from "../../state/entities";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { useHomeListOptions } from "../../features/home/home-list-options";
export { registerThreadDismissal } from "../../features/home/thread-dismissal";

/** Each environment's kind of machine, where it says. */
export function useMachineKinds() {
  return useAtomValue(threadListEnvironmentsAtom).machineByEnvironmentId;
}

/**
 * Whether the home stands in a sidebar beside a page, as T3 draws it (`HomeScreen.tsx`'s
 * `sidebarSurface`). A collapsed split, the folded Duo's, shows its primary column as the page.
 */
export function useHomeSidebar() {
  const known = use(HomeSidebarKnown);
  if (known !== null) return known;
  return use(NativePrimaryColumnContext) !== null && use(PaneContext) === "sidebar";
}

/**
 * The home's answer, read once at its top and handed down (`home/HomeFront.tsx`). T3's column
 * context also names the chat selected, so it changes at every tap on a row: each row reading it
 * for this drew again whenever the person chose a Cell (stemcells/tasks/phone-snappy.md).
 */
export const HomeSidebarKnown = createContext<boolean | null>(null);

/** The phone the home stands upright on as a page, the folded Duo too, or null: a sidebar, an iPad, a phone on its side. */
export function useUprightPhone(): "phone" | "duo-folded" | null {
  const sidebar = useHomeSidebar();
  const deviceType = useDeviceType();
  const { width, height } = useWindowDimensions();
  if (sidebar || height <= width) return null;
  return deviceType === "phone" || deviceType === "duo-folded" ? deviceType : null;
}

/** Where the header's bar ends on the Duo, under the camera's band rather than a status bar. */
export function useDuoBarBottom(): number | undefined {
  const barBottom = useBarInset();
  return isDuoDevice(useDeviceType()) ? barBottom : undefined;
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

/**
 * Brings the home to the front as its tab does (`useSelectWorkspaceTab`), with no page beside it:
 * on a phone the chat leaves the stack, in columns the detail stands empty beside the home.
 */
export function useShowHome() {
  const { openWorkspaceTab } = useAdaptiveWorkspaceLayout();
  const dispatch = useWorkspaceTabs()?.dispatch;
  return () => {
    Keyboard.dismiss();
    openWorkspaceTab("threads", { columns: false });
    dispatch?.({ type: "select", tab: "threads" });
  };
}

export { readKept, writeKept } from "./kept";
