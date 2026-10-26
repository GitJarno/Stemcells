// @effect-diagnostics nodeBuiltinImport:off - reads upstream's stylesheet on disk.
/**
 * The line the window's controls and the tab strip's row stand on (pages/frame.css,
 * `--stemcells-controls-line`). Upstream draws it: the desktop app seats the traffic lights on
 * its topbar's middle, again at each zoom, and the page centres its sidebar button there. A
 * failure after a sync names the contract that moved; the tabs likely sit off the lights.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import desktopWindow from "../../../../desktop/src/window/DesktopWindow.ts?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const appStyles = NodeFS.readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const ourFrame = NodeFS.readFileSync(new URL("../pages/frame.css", import.meta.url), "utf8");

describe("the line the window's controls stand on", () => {
  it("is the middle of the topbar the desktop app seats the traffic lights in", () => {
    const topbar = desktopWindow.match(/const MACOS_WORKSPACE_TOPBAR_HEIGHT = (\d+);/)?.[1];
    // The page's topbar, on a Mac and in a browser: the height the app seats the lights by.
    expect(topbar).toBeDefined();
    expect(appStyles.match(/\n {2}--workspace-topbar-height: (\d+)px;/)?.[1]).toBe(topbar);
    expect(appStyles).toContain("\n  --workspace-controls-top: 0px;");
    // Seated as the window opens, then at each zoom, the top of a 14 pt light
    // half a light above the topbar's middle, in the window's points.
    expect(desktopWindow).toContain("const MACOS_WINDOW_BUTTON_RADIUS = 7;");
    expect(desktopWindow).toMatch(
      /trafficLightPosition: \{\s*x: 16,\s*y: MACOS_WORKSPACE_TOPBAR_HEIGHT \/ 2 - MACOS_WINDOW_BUTTON_RADIUS,\s*\}/,
    );
    expect(desktopWindow).toMatch(
      /\(MACOS_WORKSPACE_TOPBAR_HEIGHT \* window\.webContents\.getZoomFactor\(\)\) \/ 2 -\s*MACOS_WINDOW_BUTTON_RADIUS/,
    );
    expect(desktopWindow).toMatch(
      /const zoomWindow = Effect\.fn\("desktop\.window\.zoomWindow"\)[\s\S]{0,400}syncMacosWindowButtons\(window\);/,
    );
  });

  it("is where upstream centres its sidebar button", () => {
    expect(appSidebarLayout).toMatch(
      /"pointer-events-none fixed left-\[var\(--workspace-controls-left\)\] top-\[var\(--workspace-controls-top\)\] z-50 ml-px flex h-\[var\(--workspace-topbar-height\)\] items-center",\s*isMobile && mobileSheetMounted && "hidden",\s*\)\}\s*data-sidebar-control=""/,
    );
  });

  it("is what the frame reads, from the same two properties", () => {
    expect(ourFrame).toMatch(
      /--stemcells-controls-line: calc\(\s*var\(--workspace-controls-top\) \+ var\(--workspace-topbar-height\) \/ 2\s*\);/,
    );
  });
});
