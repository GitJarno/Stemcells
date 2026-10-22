/**
 * Upstream's floating preview, its "mini player": a browser or a device
 * floating over a chat's canvas, out of the chat's right panel. Every way
 * upstream closes the panel on one floats it (`useRightPanelActions`,
 * `closePreviewPanel`), and an agent's browser may open floating. What the
 * tuck needs of it (`stemcells/surfaces/Floater.tsx`): whether a chat has
 * room for it, its face, and upstream's own two ways out of it.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  findActiveBrowserRecordingRuntimeTabId,
  useActiveBrowserRecordingTabIds,
} from "../../browser/browserRecording";
import { previewRuntimeTabId } from "../../browser/previewRuntimeTabId";
import { useFaviconForThreadUrl } from "../../browserFaviconStore";
import { useChatCanvas } from "../../components/chat/ChatCanvasContext";
import { resolveChatCanvasLayout } from "../../components/chat/chatCanvasLayout";
import { FaviconImage } from "../../components/preview/PreviewFaviconIcon";
import { resolveDeviceMiniPlayerSourceSize } from "../../components/preview/previewMiniPlayerLayout";
import { ThreadPreviewMiniPlayer } from "../../components/preview/ThreadPreviewMiniPlayer";
import {
  usePreviewMiniPlayerStore,
  type PreviewMiniPlayerSource,
} from "../../previewMiniPlayerStore";
import { useThreadPreviewState } from "../../previewStateStore";
import { useRightPanelStore } from "../../rightPanelStore";
import { browserName } from "./workbench";

export { ThreadPreviewMiniPlayer as UpstreamThreadPreviewMiniPlayer, FaviconImage };
export { observeResize } from "~/lib/observeResize";

export type FloaterSource = PreviewMiniPlayerSource;

/** The proportions assumed for a browser's page: a wide one, as most pages are. */
const BROWSER_PAGE = { width: 1280, height: 800 };

/** What upstream's canvas knows of itself (`ChatCanvasContext`). */
export interface FloaterCanvas {
  readonly container: { readonly width: number; readonly height: number };
  readonly lane: { readonly padding: number; readonly minChatWidth: number };
}

/**
 * Whether this canvas has no room for a floater beside the chat: upstream's
 * own layout puts one there at its first size and place where the canvas
 * holds both, and over the chat's words where it doesn't. Asked of the
 * canvas alone, not of the width and place the person gives the floater:
 * a floater dragged or resized over the chat in a wide canvas is theirs to
 * place (upstream lets the chat step left for it), and must not turn into
 * a card under their hand. Read at its page's proportions, a browser's
 * assumed wide: the floater measures its page only once drawn.
 */
export function floaterHasNoRoom(canvas: FloaterCanvas, source: FloaterSource): boolean {
  return resolveChatCanvasLayout({
    container: canvas.container,
    padding: canvas.lane.padding,
    minChatWidth: canvas.lane.minChatWidth,
    preview: {
      key: "floater",
      width: null,
      position: null,
      source:
        source.kind === "device"
          ? resolveDeviceMiniPlayerSourceSize(source.platform, null)
          : BROWSER_PAGE,
    },
  }).overlapsChat;
}

/** `floaterHasNoRoom` in the canvas the floater is drawn in; null until it has measured. */
export function useFloaterHasNoRoom(source: FloaterSource): boolean | null {
  const canvas = useChatCanvas();
  if (canvas === null) return false;
  if (canvas.container.width <= 0 || canvas.container.height <= 0) return null;
  return floaterHasNoRoom(canvas, source);
}

/** What a floater shows of itself while tucked. */
export interface FloaterFace {
  readonly name: string;
  /** The page a browser is on, for its mark; null for a device or a browser on none. */
  readonly url: string | null;
  /** Whether a recording of the browser is running, which upstream's floater shows by a dot. */
  readonly recording: boolean;
}

export function useFloaterFace(threadRef: ScopedThreadRef, source: FloaterSource): FloaterFace {
  const previews = useThreadPreviewState(threadRef);
  const recordingTabIds = useActiveBrowserRecordingTabIds();
  if (source.kind === "device") return { name: source.name, url: null, recording: false };
  const status = previews.sessions[source.tabId]?.navStatus ?? null;
  const runtimeTabId = previewRuntimeTabId(threadRef, previews.serverEpoch, source.tabId);
  return {
    name: browserName(status),
    url: status !== null && status._tag !== "Idle" ? status.url : null,
    recording:
      recordingTabIds.has(runtimeTabId) ||
      findActiveBrowserRecordingRuntimeTabId(threadRef, source.tabId) !== null,
  };
}

/** The mark the browser's page left in upstream's favicon store, as its panel tab shows it. */
export function useBrowserMark(threadRef: ScopedThreadRef, url: string | null): string | null {
  return useFaviconForThreadUrl(threadRef, url ?? "");
}

/**
 * Upstream's "Open in right panel": the floater ends and its browser or
 * device opens as the chat's right panel's tab.
 */
export function openFloaterInPanel(threadRef: ScopedThreadRef, source: FloaterSource): void {
  usePreviewMiniPlayerStore.getState().close(threadRef);
  const panel = useRightPanelStore.getState();
  if (source.kind === "browser") {
    panel.openBrowser(threadRef, source.tabId);
    return;
  }
  const { hostId, deviceId, platform, name } = source;
  panel.openDevice(threadRef, { hostId, deviceId, platform, name });
}

/** Upstream's "Close floating preview": the floater ends; its browser stays among the panel's tabs. */
export function closeFloater(threadRef: ScopedThreadRef): void {
  usePreviewMiniPlayerStore.getState().close(threadRef);
}
