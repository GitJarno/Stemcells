/**
 * What Look needs of upstream: a Cell's right panel (open, empty, its last surface), closing and
 * reopening it through upstream's store, whether the window fits the panel inline, and the focus
 * facts that say an Esc is someone else's. When a Cell's chat was last written in is
 * `useCellLastSent` (`chat.tsx`).
 */
import type { PreviewNavStatus } from "@t3tools/contracts";
import { getTerminalLabel } from "@t3tools/shared/terminalLabels";

import { isCommandPaletteOpen } from "../../commandPaletteBus";
import { isContextMenuOpen } from "../../contextMenuFallback";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { isTerminalFocused } from "../../lib/terminalFocus";
import {
  browserMiniPlayerSource,
  previewMiniPlayerSourceKey,
  selectThreadPreviewMiniPlayer,
  usePreviewMiniPlayerStore,
  type PreviewMiniPlayerSource,
} from "../../previewMiniPlayerStore";
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
import { layerOpen } from "./layers";
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

/**
 * Closes the Cell's right panel as upstream's close does (`useRightPanelActions`,
 * `closePreviewPanel`): a browser or device it showed floats on over the chat, tucked where
 * there's no room, and the panel leaves maximized. Its surfaces stay, so reopening shows the same.
 */
export function closeCellPanel(cell: CellRef): void {
  const ref = threadRefOf(cell);
  const store = useRightPanelStore.getState();
  if (!selectThreadRightPanelState(store.byThreadKey, ref).isOpen) return;
  const floater = floaterOf(selectActiveRightPanelSurface(store.byThreadKey, ref));
  if (floater !== null) usePreviewMiniPlayerStore.getState().open(ref, floater);
  store.setMaximized(ref, false);
  store.close(ref);
}

/** What upstream floats when its panel closes on a surface: a browser, a device, or nothing. */
function floaterOf(surface: RightPanelSurface | null): PreviewMiniPlayerSource | null {
  if (surface?.kind === "preview" && surface.resourceId) {
    return browserMiniPlayerSource(surface.resourceId);
  }
  if (surface?.kind === "device" && surface.target) return { kind: "device", ...surface.target };
  return null;
}

/**
 * Whether the surface the Cell's panel last showed floats over its chat
 * (or is tucked at its edge), so the chat already shows it.
 */
export function useCellSurfaceFloats(cell: CellRef | null): boolean {
  const ref = cell ? threadRefOf(cell) : null;
  const surface = useRightPanelStore((state) =>
    ref ? selectSelectedRightPanelSurface(state.byThreadKey, ref) : null,
  );
  const floating = usePreviewMiniPlayerStore((state) =>
    selectThreadPreviewMiniPlayer(state.byThreadKey, ref),
  );
  const floater = floaterOf(surface);
  return (
    floater !== null &&
    floating !== null &&
    previewMiniPlayerSourceKey(floater) === previewMiniPlayerSourceKey(floating.source)
  );
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

/**
 * Whether upstream puts the Cell's panel beside its chat, not in its sheet: the window is wide
 * enough, or the panel is maximized, which a narrow window keeps inline too.
 */
export function useInlinePanels(cell: CellRef | null): boolean {
  const narrow = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const maximized = useRightPanelStore((state) =>
    cell
      ? selectThreadRightPanelState(state.byThreadKey, threadRefOf(cell)).maximized === true
      : false,
  );
  return !narrow || maximized;
}

/**
 * What answers Esc itself beside upstream's layers (`layers.ts`): the right
 * panel's sheet while it is open or still leaving (it stays mounted closed),
 * a chat's find bar, and a chat's full-screen app view.
 */
const ESCAPE_HOLDERS = [
  '[data-slot="sheet-popup"]:is([data-open],[data-ending-style])',
  "[data-thread-find-bar]",
  "[data-mcp-app-fullscreen]",
].join(", ");

/**
 * Whether something of upstream's holds Esc now: an open layer (not one kept mounted closed),
 * the command palette, a context menu, or focus in a terminal or the desktop browser's page,
 * which take the key. The server browser's page is a text field and stops the keys it sends.
 */
export function escapeHeldElsewhere(): boolean {
  return (
    isCommandPaletteOpen() ||
    isContextMenuOpen() ||
    isTerminalFocused() ||
    document.activeElement?.tagName === "WEBVIEW" ||
    layerOpen() ||
    document.querySelector(ESCAPE_HOLDERS) !== null
  );
}
