// Where the phone home's foot stands, from T3's layout and the composer's gutter. Apart from
// `home.ts` because the composer's module reaches the thread list, which draws our rows.

import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPOSER_BOTTOM_GUTTER } from "../../components/ComposerSurface";
import { useWorkspaceTabs } from "../../features/layout/workspace/WorkspaceTabsContext";
import {
  useCompactWorkspaceTabs,
  useSidebarWorkspaceTabs,
} from "../../features/layout/workspace/useSystemWorkspaceTabBar";
import {
  useDeviceType,
  useDuoBottomBarInset,
  useNativeColumnLayoutMetrics,
  useNativeLayoutMetrics,
} from "../../native/native-layout-metrics";
import { homeFoot } from "./homeFoot";

/** The home's foot on iOS (`homeFoot.ts`), and the sides a view over it keeps. */
export function useOverSearch(): {
  readonly notice: number;
  readonly pill: number;
  readonly rest: number;
  readonly above: number;
  readonly left: number;
  readonly right: number;
} {
  const insets = useSafeAreaInsets();
  const deviceType = useDeviceType();
  const workspace = useWorkspaceTabs();
  const sides = deviceType === "phone" ? { left: 29, right: 23 } : { left: 20, right: 20 };
  const foot = homeFoot({
    deviceType,
    insetsBottom: insets.bottom,
    column: useNativeColumnLayoutMetrics(),
    root: useNativeLayoutMetrics(),
    searchMode: workspace?.state.tabs.threads.searchMode,
    bottomClearance: workspace?.bottomClearance ?? 0,
    sidebarPicker: useSidebarWorkspaceTabs() === "picker",
    compactTabs: useCompactWorkspaceTabs(),
    duoBar: useDuoBottomBarInset(),
    keyboardHeight: useKeyboardState((keyboard) => keyboard.height),
    composerGutter: COMPOSER_BOTTOM_GUTTER,
  });
  return { ...foot, ...sides };
}
