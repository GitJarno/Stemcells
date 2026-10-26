/**
 * Upstream's native surfaces, as `stemcells/surfaces/` moves them: the desktop browser is an
 * Electron `<webview>` kept once at the app's root, in a wrapper fixed at the rect its panel
 * slot last presented (`BrowserSurfaceSlot`, `browserSurfaceStore`). Our folder gets upstream's
 * slot here; upstream's views get ours (`substitutes/BrowserSurfaceSlot.tsx`).
 */
import type { PlacedView } from "../surfaces/ride";

import { BrowserSurfaceSlot } from "../../browser/BrowserSurfaceSlot";
import { useBrowserSurfaceStore } from "../../browser/browserSurfaceStore";
import { HostedBrowserWebview } from "../../browser/HostedBrowserWebview";

export { BrowserSurfaceSlot as UpstreamBrowserSurfaceSlot };
export { HostedBrowserWebview as UpstreamHostedBrowserWebview };

/**
 * Whether something wants a browser now: a slot shows it (its Surface on
 * stage, or the mini player), or upstream keeps it busy in the background.
 */
export function useBrowserWanted(runtimeTabId: string): boolean {
  return useBrowserSurfaceStore(
    (state) =>
      state.byTabId[runtimeTabId]?.owner != null || (state.activityByTabId[runtimeTabId] ?? 0) > 0,
  );
}

/** Where upstream keeps the browsers' views, shown or not (`ElectronBrowserHost`); null on the web. */
export function browserViews(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-electron-browser-host]");
}

/** A browser tab's view, its page's box, and where upstream placed it; null while it isn't shown. */
export function shownBrowserView(tabId: string): PlacedView | null {
  const element = document.querySelector<HTMLElement>(
    `[data-preview-viewport="${CSS.escape(tabId)}"]`,
  );
  // Upstream gives a shown view the pointer, a hidden one none (`hostedBrowserWebviewStyle.ts`).
  if (element === null || element.style.pointerEvents !== "auto") return null;
  // Its first box holds the page, the webview inside it.
  const content = element.firstElementChild;
  if (!(content instanceof HTMLElement)) return null;
  return { element, content, x: parseFloat(element.style.left), y: parseFloat(element.style.top) };
}
