/**
 * Upstream behaviour a riding browser relies on (`stemcells/surfaces/`). A
 * failure here after a sync names the contract that moved; the fix goes in
 * `surfaces.ts` or the substitute, not in the ride.
 */
import { describe, expect, it } from "vite-plus/test";

import {
  acquireBrowserSurface,
  acquireBrowserSurfaceActivity,
  useBrowserSurfaceStore,
} from "../../browser/browserSurfaceStore";
import { resolveBrowserViewportLayout } from "../../browser/browserViewportLayout";
import { resolveHostedBrowserWebviewWrapperStyle } from "../../browser/hostedBrowserWebviewStyle";

import slot from "../../browser/BrowserSurfaceSlot.tsx?raw";
import host from "../../browser/ElectronBrowserHost.tsx?raw";
import hosted from "../../browser/HostedBrowserWebview.tsx?raw";
import previewView from "../../components/preview/PreviewView.tsx?raw";

const hidden = { width: 800, height: 600 };

describe("native surfaces' contracts with upstream", () => {
  it("a shown browser sits at its slot's point and takes the pointer; a hidden one doesn't", () => {
    // shownBrowserView reads the view's point from its left and top, and
    // tells shown from hidden by its pointer events.
    const rect = { x: 120, y: 36, width: 500, height: 900 };
    const shown = resolveHostedBrowserWebviewWrapperStyle({
      active: true,
      renderingActive: true,
      rect,
      hiddenSize: hidden,
    });
    expect(shown).toMatchObject({ left: 120, top: 36, pointerEvents: "auto" });
    for (const renderingActive of [true, false]) {
      expect(
        resolveHostedBrowserWebviewWrapperStyle({
          active: false,
          renderingActive,
          keepPaintableWhenInactive: true,
          rect,
          hiddenSize: hidden,
        }),
      ).toMatchObject({ pointerEvents: "none" });
    }
  });

  it("upstream never moves, cuts or opens the view itself, so ours stay until we let go", () => {
    const shown = resolveHostedBrowserWebviewWrapperStyle({
      active: true,
      renderingActive: true,
      cornerRadius: 8,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      hiddenSize: hidden,
    });
    for (const property of ["transform", "clipPath", "overflow", "backgroundColor", "opacity"]) {
      expect(shown).not.toHaveProperty(property);
    }
    expect(hosted).toContain('style={{ ...wrapperStyle, overscrollBehavior: "contain" }}');
    // Its overflow and ground are its classes, which the ride's inline style
    // outranks while its page moves out of its box.
    expect(hosted).toContain('className="fixed overflow-hidden bg-muted/35"');
  });

  it("the view's first box holds the page, at its top-left, as big as the view", () => {
    // The ride moves that box inside the view, which it cuts (`ride.ts`).
    expect(hosted).toMatch(
      /data-preview-viewport=\{runtimeTabId\}\s*>\s*<div className="relative" style=\{\{ width: layout\.canvasWidth, height: layout\.canvasHeight \}\}>/,
    );
    for (const setting of [
      { _tag: "fill" },
      { _tag: "freeform", width: 900, height: 600 },
    ] as const) {
      expect(resolveBrowserViewportLayout({ width: 500, height: 900 }, setting)).toMatchObject({
        canvasWidth: 500,
        canvasHeight: 900,
      });
    }
  });

  it("a slot claims its browser while it is mounted, and background work holds it", () => {
    // useBrowserWanted reads both: a browser wakes when either wants it.
    const owner = () => useBrowserSurfaceStore.getState().byTabId["wanted-tab"]?.owner ?? null;
    const lease = acquireBrowserSurface("wanted-tab");
    expect(owner()).not.toBeNull();
    lease.release();
    expect(owner()).toBeNull();
    const release = acquireBrowserSurfaceActivity("wanted-tab");
    expect(useBrowserSurfaceStore.getState().activityByTabId["wanted-tab"]).toBe(1);
    release();
    expect(useBrowserSurfaceStore.getState().activityByTabId["wanted-tab"]).toBeUndefined();
    expect(slot).toContain("let lease = acquireBrowserSurface(tabId, fitSourceContent);");
  });

  it("the views live in one host, shown or not", () => {
    // The ride watches it while the pages move, to catch a view as it comes.
    expect(host).toContain('<div className="contents" data-electron-browser-host>');
    expect(host).toContain("<HostedBrowserWebview {...props} profileId={profileId} />");
  });

  it("the view and its slot are named by the same browser tab", () => {
    expect(hosted).toContain("data-preview-viewport={runtimeTabId}");
    expect(previewView).toMatch(
      /<BrowserSurfaceSlot\s+key=\{runtimeTabId\}\s+tabId=\{runtimeTabId\}/,
    );
  });

  it("the slot is one box, and it presents again on a new layout version", () => {
    // Our substitute measures upstream's box, the first child of a wrapper
    // without one, and bumps the version when the pages rest.
    expect(slot).toContain(
      "return <div ref={attachSurface} className={className} data-browser-surface-slot={tabId} />;",
    );
    expect(slot).toMatch(
      /const attachSurface = \(element: HTMLDivElement\) => \{[\s\S]*?const rect = element\.getBoundingClientRect\(\);/,
    );
    expect(slot).toMatch(/\[\s*cornerRadius,[^\]]*layoutVersion,\s*visible,\s*zIndex,\s*\]/);
  });
});
