// What the phone's home takes from upstream's: its tabs, how it opens a chat and comes back, its
// column, whether it stands in the workspace, the inset its list rests under, where its search
// stands, the header's items, the machines and projects in view, the older settled chats the
// servers keep, where the phone keeps its picks, and when a row starts to leave.

import { useAtomValue } from "@effect/atom-react";
import { Directory, File, Paths } from "expo-file-system";
import { Keyboard } from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_BOTTOM_GUTTER } from "../../components/ComposerSurface";
import { useAdaptiveWorkspaceLayout } from "../../features/layout/adaptive-workspace-context";
import { useWorkspaceTabs } from "../../features/layout/workspace/WorkspaceTabsContext";
import { useSelectWorkspaceDetail } from "../../features/layout/workspace/useSelectWorkspaceDetail";
import { workspaceSearchBottomClearance } from "../../features/layout/workspace/workspace-tabs-state";
import {
  useCompactWorkspaceTabs,
  useSidebarWorkspaceTabs,
} from "../../features/layout/workspace/useSystemWorkspaceTabBar";
import { isDuoDevice } from "../../lib/device-type";
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
export { registerThreadDismissal } from "../../features/home/thread-dismissal";

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
 * The home's foot on iOS: where T3's undo notice stands now (`features/home/ThreadUndoNotice.tsx`,
 * copied), and the stages' pill over the search: at `rest`, or `above` a keyboard's top. The search
 * rides only a keyboard it holds; another field's covers it, so the pill then stands level with the
 * composer's foot beside it. `pill` is its place once the keyboard settles.
 */
export function useOverSearch(): {
  readonly notice: number;
  readonly pill: number;
  readonly rest: number;
  readonly above: number;
  readonly left: number;
  readonly right: number;
} {
  const insets = useSafeAreaInsets();
  const columnMetrics = useNativeColumnLayoutMetrics();
  const rootMetrics = useNativeLayoutMetrics();
  const workspace = useWorkspaceTabs();
  const deviceType = useDeviceType();
  const sidebarTabs = useSidebarWorkspaceTabs();
  const compactTabs = useCompactWorkspaceTabs();
  const duoBar = useDuoBottomBarInset();
  const keyboardHeight = useKeyboardState((keyboard) => keyboard.height);
  const sides = deviceType === "phone" ? { left: 29, right: 23 } : { left: 20, right: 20 };
  // The Duo's native tab pill extends above the 48-point toolbar reservation.
  const padding = (keyboard: number) =>
    duoBar === undefined ? (deviceType === "phone" && keyboard === 0 ? 32 : 16) : 8;
  const foldedResting =
    rootMetrics?.hasHinge &&
    rootMetrics.horizontalSizeClass === "compact" &&
    workspace?.state.tabs.threads.searchMode === "resting";
  // T3's clearance is a fixed part over max(its rest, the keyboard) (`WorkspaceRootScreen.tsx`,
  // whose inset is the window's even where it hands the home none); the keyboard is taken back
  // out, so the pill's place can be had for any keyboard.
  const clearanceRest =
    (compactTabs ? (rootMetrics?.safeArea.bottom ?? insets.bottom) : insets.bottom) +
    (isDuoDevice(deviceType) && sidebarTabs === "picker" ? 64 : 0);
  const clearance = (keyboard: number) =>
    (workspace?.bottomClearance ?? 0) -
    Math.max(0, keyboardHeight - clearanceRest) +
    Math.max(0, keyboard - clearanceRest);
  const overBar = (keyboard: number) =>
    rootMetrics?.hasHinge === true
      ? workspaceSearchBottomClearance({
          bottomInset: rootMetrics.safeArea.bottom,
          bottomBarInset: rootMetrics.bottomBarInset,
          keyboardHeight: keyboard,
        }) - 8
      : 0;
  const overSearch = (keyboard: number) =>
    rootMetrics?.hasHinge && rootMetrics.verticalBarEdge !== "none"
      ? overBar(keyboard)
      : Math.max(
          insets.bottom,
          columnMetrics?.safeArea.bottom ?? 0,
          clearance(keyboard) - padding(keyboard),
        ) + 8;
  const notice = foldedResting
    ? Math.max(rootMetrics.bottomBarInset ?? rootMetrics.safeArea.bottom + 8, keyboardHeight + 8)
    : overSearch(keyboardHeight);
  const pillAt = foldedResting ? overBar : overSearch;
  const rest = pillAt(0);
  const above =
    workspace?.state.tabs.threads.searchMode === "active"
      ? pillAt(PAST_EVERY_REST) - PAST_EVERY_REST
      : COMPOSER_BOTTOM_GUTTER;
  const pill = keyboardHeight > 0 ? Math.max(rest, keyboardHeight + above) : rest;
  return { notice, pill, rest, above, ...sides };
}

/** A keyboard taller than any rest, to read how far over its top a place stands. */
const PAST_EVERY_REST = 10_000;
