// What the phone's home takes from upstream's: its tabs, how it opens a chat and comes back,
// which column it stands in, whether it stands in the workspace, the top inset its list rests
// under, where its search stands, the header's items, the machines and projects its list is
// narrowed to, how many older settled chats the servers keep, and where the phone keeps its picks.

import { useAtomValue } from "@effect/atom-react";
import { Directory, File, Paths } from "expo-file-system";
import { Keyboard } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import { useWorkspaceTabs } from "../../features/layout/workspace/WorkspaceTabsContext";
import { useSelectWorkspaceDetail } from "../../features/layout/workspace/useSelectWorkspaceDetail";
import { workspaceSearchBottomClearance } from "../../features/layout/workspace/workspace-tabs-state";
import { writeFileAtomically } from "../../lib/atomic-file";
import {
  useDeviceType,
  useDuoBottomBarInset,
  useNativeColumnLayoutMetrics,
  useNativeLayoutMetrics,
} from "../../native/native-layout-metrics";
import { threadListEnvironmentsAtom } from "../../state/presentation";

export type { EnvironmentMachineKind } from "@t3tools/contracts";

export { SegmentedControl } from "../../components/ui/SegmentedControl";
export { useContentTopInset } from "../../components/ui/useBarInset";
export {
  useWorkspaceTabs,
  WorkspaceTabsContext,
} from "../../features/layout/workspace/WorkspaceTabsContext";
export { useOlderSettledShelf } from "../../state/olderSettledShelf";
export type { OlderSettledScope } from "@t3tools/client-runtime/state/threads";
export { NativePrimaryColumnContext } from "../../native/v5-workspace-context";
export { Toolbar } from "../../components/ui/Toolbar";
export { Menu } from "../../components/ui/Menu";
export { SymbolView } from "../../components/ui/AppSymbol";
export { ProjectFavicon } from "../../components/ProjectFavicon";
export { ENVIRONMENT_MACHINE_SYMBOLS } from "../../components/EnvironmentMachineSymbol";
export { useProjects } from "../../state/entities";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { useHomeListOptions } from "../../features/home/home-list-options";

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

const keptFile = (name: string) => new File(new Directory(Paths.document, "stemcells"), name);

/** A small file of ours on the phone, read whole; null when there's none yet. */
export function readKept(name: string): string | null {
  try {
    const file = keptFile(name);
    return file.exists ? file.textSync() : null;
  } catch {
    return null;
  }
}

/** Writes a small file of ours whole, so a crash mid-write leaves the last one. */
export function writeKept(name: string, text: string): Promise<void> {
  return writeFileAtomically(keptFile(name), text).catch(() => undefined);
}

/**
 * The home's foot on iOS. `notice` is where T3's undo notice stands (`features/home/
 * ThreadUndoNotice.tsx`, its placement copied): over the search, riding the keyboard, or level with
 * the folded Duo's tab pill while its search rests. `pill` is the same, but over that tab pill.
 */
export function useOverSearch(): {
  readonly notice: number;
  readonly pill: number;
  readonly left: number;
  readonly right: number;
} {
  const insets = useSafeAreaInsets();
  const columnMetrics = useNativeColumnLayoutMetrics();
  const rootMetrics = useNativeLayoutMetrics();
  const workspace = useWorkspaceTabs();
  const deviceType = useDeviceType();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const sides = deviceType === "phone" ? { left: 29, right: 23 } : { left: 20, right: 20 };
  // The Duo's native tab pill extends above the 48-point toolbar reservation.
  const padding =
    useDuoBottomBarInset() === undefined
      ? deviceType === "phone" && keyboardHeight === 0
        ? 32
        : 16
      : 8;
  const foldedResting =
    rootMetrics?.hasHinge &&
    rootMetrics.horizontalSizeClass === "compact" &&
    workspace?.state.tabs.threads.searchMode === "resting";
  const overBar =
    rootMetrics?.hasHinge === true
      ? workspaceSearchBottomClearance({
          bottomInset: rootMetrics.safeArea.bottom,
          bottomBarInset: rootMetrics.bottomBarInset,
          keyboardHeight,
        }) - 8
      : 0;
  const notice = foldedResting
    ? Math.max(rootMetrics.bottomBarInset ?? rootMetrics.safeArea.bottom + 8, keyboardHeight + 8)
    : rootMetrics?.hasHinge && rootMetrics.verticalBarEdge !== "none"
      ? overBar
      : Math.max(
          insets.bottom,
          columnMetrics?.safeArea.bottom ?? 0,
          (workspace?.bottomClearance ?? 0) - padding,
        ) + 8;
  return { notice, pill: foldedResting ? overBar : notice, ...sides };
}
