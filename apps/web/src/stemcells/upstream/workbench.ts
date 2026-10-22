/**
 * What Look needs of upstream: a Cell's right panel (open or not, empty or
 * not, the surface it last showed), closing and reopening it through
 * upstream's own store, whether the window is wide enough for the panel to
 * sit inline, and
 * the focus facts that say an Esc is someone else's. When the user last
 * wrote in a Cell's chat is `useCellLastSent` (`chat.tsx`).
 */
import type { PreviewNavStatus } from "@t3tools/contracts";
import { getTerminalLabel } from "@t3tools/shared/terminalLabels";

import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { isContextMenuOpen } from "../../contextMenuFallback";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { isTerminalFocused } from "../../lib/terminalFocus";
import { useThreadPreviewState } from "../../previewStateStore";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../../rightPanelLayout";
import {
  selectActiveRightPanelSurface,
  selectSelectedRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
  type RightPanelSurface,
} from "../../rightPanelStore";
import type { CellRef } from "../tabs/layout";
import { threadRefOf } from "./routes";

/** Whether the Cell's right panel is open. Upstream keeps it per thread, a draft's under its thread. */
export function useCellPanelOpen(cell: CellRef | null): boolean {
  return useRightPanelStore((state) =>
    cell ? selectThreadRightPanelState(state.byThreadKey, threadRefOf(cell)).isOpen : false,
  );
}

/**
 * Whether the Cell's right panel is open on no surface, where upstream
 * shows its picker ("Open a surface").
 */
export function useCellPanelEmpty(cell: CellRef | null): boolean {
  return useRightPanelStore((state) => {
    if (!cell) return false;
    const ref = threadRefOf(cell);
    return (
      selectThreadRightPanelState(state.byThreadKey, ref).isOpen &&
      selectActiveRightPanelSurface(state.byThreadKey, ref) === null
    );
  });
}

/** Whether the Cell's right panel is open on a browser. */
export function useCellPanelOnBrowser(cell: CellRef | null): boolean {
  return useRightPanelStore((state) => {
    if (!cell) return false;
    const ref = threadRefOf(cell);
    return (
      selectThreadRightPanelState(state.byThreadKey, ref).isOpen &&
      selectActiveRightPanelSurface(state.byThreadKey, ref)?.kind === "preview"
    );
  });
}

/** Closes the Cell's right panel. Its surfaces stay, so reopening shows the same one. */
export function closeCellPanel(cell: CellRef): void {
  const ref = threadRefOf(cell);
  const store = useRightPanelStore.getState();
  if (selectThreadRightPanelState(store.byThreadKey, ref).isOpen) store.close(ref);
}

/** Reopens the Cell's right panel on the surface it last showed. */
export function openCellPanel(cell: CellRef): void {
  useRightPanelStore.getState().show(threadRefOf(cell));
}

/**
 * The name of the surface the Cell's panel shows or last showed, as
 * upstream's panel tab names it; null when it has none.
 */
export function useCellSurfaceName(cell: CellRef | null): string | null {
  const ref = cell ? threadRefOf(cell) : null;
  const surface = useRightPanelStore((state) =>
    ref ? selectSelectedRightPanelSurface(state.byThreadKey, ref) : null,
  );
  const previews = useThreadPreviewState(surface?.kind === "preview" ? ref : null);
  if (surface === null) return null;
  return surfaceName(surface, (id) => previews.sessions[id]?.navStatus ?? null);
}

/** Upstream's tab title for a surface (`RightPanelTabs`' `surfaceTitle`). */
export function surfaceName(
  surface: RightPanelSurface,
  navStatusOf: (previewId: string) => PreviewNavStatus | null,
): string {
  switch (surface.kind) {
    case "diff":
      return "Diff";
    case "files":
      return "Files";
    case "file":
      return surface.relativePath.split(/[/\\]/).at(-1) ?? surface.relativePath;
    case "terminal":
      return getTerminalLabel(surface.activeTerminalId);
    case "pull-request":
      return `#${surface.number}`;
    case "pull-requests":
      return "Pull requests";
    case "device":
      return surface.title ?? surface.target?.name ?? "Device";
    case "preview":
      return browserName(surface.resourceId ? navStatusOf(surface.resourceId) : null);
  }
}

/** Upstream's tab title for a browser: its page's title, else its host. */
export function browserName(status: PreviewNavStatus | null): string {
  if (status === null || status._tag === "Idle") return "Browser";
  if (status.title.trim().length > 0) return status.title;
  try {
    return new URL(status.url).host || "Browser";
  } catch {
    return "Browser";
  }
}

/** Whether the window is wide enough for upstream to put a panel beside its chat, not in a sheet. */
export function useInlinePanels(): boolean {
  return !useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
}

/**
 * What answers Esc itself while it is on screen: upstream's dialogs, sheets,
 * popovers, menus and selects (base-ui popups, mounted only while open), a
 * chat's find bar, and a chat's full-screen app view.
 */
const OPEN_OVERLAY = [
  ...["dialog-popup", "sheet-popup", "popover-popup", "menu-popup", "select-popup"].map(
    (slot) => `[data-slot="${slot}"]`,
  ),
  "[data-thread-find-bar]",
  "[data-mcp-app-fullscreen]",
].join(", ");

/**
 * Whether something of upstream's holds Esc right now: an open overlay,
 * the command palette or a context menu, or focus in a terminal or in the
 * desktop browser's page, which take the key for the shell or the page.
 * (The server browser's page is a text field and stops the keys it sends.)
 */
export function escapeHeldElsewhere(): boolean {
  return (
    isCommandPaletteOpen() ||
    isContextMenuOpen() ||
    isTerminalFocused() ||
    document.activeElement?.tagName === "WEBVIEW" ||
    document.querySelector(OPEN_OVERLAY) !== null
  );
}
