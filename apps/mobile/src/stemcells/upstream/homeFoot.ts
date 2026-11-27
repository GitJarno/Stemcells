// Where the home's foot stands on iOS (`useOverSearch`, `home.ts`), from what T3's layout reads,
// apart from the hooks so Node can test it.

import { isDuoDevice, type DeviceType } from "../../lib/device-type";
import type { NativeLayoutMetrics } from "../../lib/reserved-regions";
import {
  workspaceSearchBottomClearance,
  type WorkspaceSearchMode,
} from "../../features/layout/workspace/workspace-tabs-state";

export interface HomeFootInput {
  readonly deviceType: DeviceType;
  readonly insetsBottom: number;
  readonly column: NativeLayoutMetrics | null;
  readonly root: NativeLayoutMetrics | null;
  readonly searchMode: WorkspaceSearchMode | undefined;
  /** T3's `bottomClearance` for the home's tab. */
  readonly bottomClearance: number;
  readonly sidebarPicker: boolean;
  readonly compactTabs: boolean;
  /** Where the Duo's floating bottom controls end in this column (`useDuoBottomBarInset`). */
  readonly duoBar: number | undefined;
  readonly keyboardHeight: number;
  /** How far over a keyboard the composer's foot stands. */
  readonly composerGutter: number;
}

/**
 * Where T3's undo notice stands now (`features/home/ThreadUndoNotice.tsx`, copied), and the
 * stages' pill over the search: at `rest`, or `above` a keyboard's top. The search rides only a
 * keyboard it holds; another field's covers it, so the pill then stands level with the
 * composer's foot beside it. `pill` is its place once the keyboard settles.
 */
export function homeFoot(input: HomeFootInput) {
  const { deviceType, root, keyboardHeight } = input;
  // The Duo's native tab pill extends above the 48-point toolbar reservation.
  const padding = (keyboard: number) =>
    input.duoBar === undefined ? (deviceType === "phone" && keyboard === 0 ? 32 : 16) : 8;
  // Folded, the Duo's search is the rail's button until it opens: nothing stands at the foot.
  const foldedResting =
    root?.hasHinge === true &&
    root.horizontalSizeClass === "compact" &&
    input.searchMode === "resting";
  // T3's clearance is a fixed part over max(its rest, the keyboard) (`WorkspaceRootScreen.tsx`,
  // whose inset is the window's even where it hands the home none); the keyboard is taken back
  // out, so the pill's place can be had for any keyboard.
  const clearanceRest =
    (input.compactTabs ? (root?.safeArea.bottom ?? input.insetsBottom) : input.insetsBottom) +
    (isDuoDevice(deviceType) && input.sidebarPicker ? 64 : 0);
  const clearance = (keyboard: number) =>
    input.bottomClearance -
    Math.max(0, keyboardHeight - clearanceRest) +
    Math.max(0, keyboard - clearanceRest);
  const overSearch = (keyboard: number) =>
    root?.hasHinge && root.verticalBarEdge !== "none"
      ? workspaceSearchBottomClearance({
          bottomInset: root.safeArea.bottom,
          bottomBarInset: root.bottomBarInset,
          keyboardHeight: keyboard,
        }) - 8
      : Math.max(
          input.insetsBottom,
          input.column?.safeArea.bottom ?? 0,
          clearance(keyboard) - padding(keyboard),
        ) + 8;
  // Level with the rail's lowest group, whose pill floats inside the bottom safe area.
  const railFoot = (keyboard: number) =>
    Math.max(
      root?.bottomBarInset ?? (root?.safeArea.bottom ?? input.insetsBottom) + 8,
      keyboard + 8,
    );
  const pillAt = foldedResting ? railFoot : overSearch;
  const notice = pillAt(keyboardHeight);
  const rest = pillAt(0);
  const above =
    input.searchMode === "active"
      ? overSearch(PAST_EVERY_REST) - PAST_EVERY_REST
      : input.composerGutter;
  const pill = keyboardHeight > 0 ? Math.max(rest, keyboardHeight + above) : rest;
  return { notice, pill, rest, above };
}

/** A keyboard taller than any rest, to read how far over its top a place stands. */
const PAST_EVERY_REST = 10_000;
