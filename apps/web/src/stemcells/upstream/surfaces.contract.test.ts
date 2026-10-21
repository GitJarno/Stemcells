/**
 * Upstream behaviour a riding browser relies on (`stemcells/surfaces/`). A
 * failure here after a sync names the contract that moved; the fix goes in
 * `surfaces.ts` or the substitute, not in the ride.
 */
import { describe, expect, it } from "vite-plus/test";

import { resolveHostedBrowserWebviewWrapperStyle } from "../../browser/hostedBrowserWebviewStyle";

import slot from "../../browser/BrowserSurfaceSlot.tsx?raw";
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

  it("upstream never moves or cuts the view itself, so ours stay until we let go", () => {
    const shown = resolveHostedBrowserWebviewWrapperStyle({
      active: true,
      renderingActive: true,
      cornerRadius: 8,
      rect: { x: 0, y: 0, width: 10, height: 10 },
      hiddenSize: hidden,
    });
    expect(shown).not.toHaveProperty("transform");
    expect(shown).not.toHaveProperty("clipPath");
    expect(hosted).toContain('style={{ ...wrapperStyle, overscrollBehavior: "contain" }}');
  });

  it("the view's first box holds the page, at its top-left", () => {
    // The ride cuts that box, not the view it moves (`ride.ts`).
    expect(hosted).toMatch(
      /data-preview-viewport=\{runtimeTabId\}\s*>\s*<div className="relative" style=\{\{ width: layout\.canvasWidth, height: layout\.canvasHeight \}\}>/,
    );
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
      "return <div ref={elementRef} className={className} data-browser-surface-slot={tabId} />;",
    );
    expect(slot).toMatch(/\[\s*cornerRadius,[^\]]*layoutVersion,\s*visible,\s*zIndex,\s*\]/);
  });
});
