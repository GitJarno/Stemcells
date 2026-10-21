/**
 * Upstream's native surfaces, as `stemcells/surfaces/` moves them. The
 * desktop browser is an Electron `<webview>` the app keeps once, at its root
 * (`HostedBrowserWebview`), in a wrapper fixed at the rect its slot in a
 * panel last presented (`BrowserSurfaceSlot`, `browserSurfaceStore`). Our
 * folder gets upstream's slot here; upstream's views get ours
 * (`substitutes/BrowserSurfaceSlot.tsx`).
 */
import type { PlacedView } from "../surfaces/ride";

import { BrowserSurfaceSlot } from "../../browser/BrowserSurfaceSlot";

export { BrowserSurfaceSlot as UpstreamBrowserSurfaceSlot };

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
