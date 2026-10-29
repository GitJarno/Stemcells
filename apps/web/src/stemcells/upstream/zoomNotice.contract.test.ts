// @effect-diagnostics nodeBuiltinImport:off - reads a style sheet and Base UI's toast store from disk.
/**
 * What the zoom level's toast relies on upstream. A failure here after a
 * sync names the contract that moved: where a zoom happens and how the page
 * hears it, or how upstream's toasts take one toast added again.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import toastSource from "../../components/ui/toast.tsx?raw";
import appSidebarLayoutSource from "../../components/AppSidebarLayout.tsx?raw";
import browserZoomSource from "../../browser/useBrowserLayoutZoomFactor.ts?raw";
import desktopWindowSource from "../../../../desktop/src/window/DesktopWindow.ts?raw";
import preloadSource from "../../../../desktop/src/preload.ts?raw";
import leftColumnSource from "../rail/LeftColumn.tsx?raw";
import { SUBSTITUTES } from "./substitutes/plugin";
import sidebarSubstituteSource from "./substitutes/Sidebar.tsx?raw";
import zoomNoticeSource from "./zoomNotice.tsx?raw";

const zoomCss = NodeFS.readFileSync(new URL("../zoom/zoom.css", import.meta.url), "utf8");
const baseUiToastStore = NodeFS.readFileSync(
  NodePath.join(
    NodePath.dirname(
      NodeModule.createRequire(import.meta.url).resolve("@base-ui/react/package.json"),
    ),
    "esm/toast/store.js",
  ),
  "utf8",
);

describe("a zoom, where it happens", () => {
  it("every zoom of the desktop app sets its webContents' level", () => {
    // ⌘+ ⌘− ⌘0 and the View menu (zoomMain), and Ctrl+wheel or a pinch (zoom-changed).
    expect(desktopWindowSource).toMatch(
      /const zoomWindow = Effect\.fn\("desktop\.window\.zoomWindow"\)[\s\S]{0,300}webContents\.setZoomLevel\(\s*direction === "reset" \? 0 : webContents\.getZoomLevel\(\) \+ \(direction === "in" \? 0\.5 : -0\.5\),/,
    );
    expect(desktopWindowSource).toMatch(
      /webContents\.on\("zoom-changed", \(_event, direction\) => \{[\s\S]{0,120}zoomWindow\(window, direction\)/,
    );
    expect(desktopWindowSource).toMatch(
      /zoomMain: Effect\.fn\("desktop\.window\.zoomMain"\)[\s\S]{0,400}yield\* zoomWindow\(window\.value, direction\);/,
    );
  });

  it("the page reads the app's zoom from the bridge, and hears it as a resize", () => {
    expect(preloadSource).toContain("getWindowZoomFactor: () => webFrame.getZoomFactor(),");
    // Upstream's own zoom reader listens the same way.
    expect(browserZoomSource).toContain(
      "// App zoom changes the CSS viewport, so resize also signals zoom changes.",
    );
    expect(browserZoomSource).toContain('window.addEventListener("resize", onChange);');
  });

  it("the column that listens is on every page", () => {
    // The app's sidebar slot renders `components/Sidebar.tsx`, which our substitute wraps in the column.
    expect(appSidebarLayoutSource).toContain('import ThreadSidebar from "./Sidebar";');
    expect(SUBSTITUTES["apps/web/src/components/Sidebar.tsx"]).toBe("Sidebar.tsx");
    expect(sidebarSubstituteSource).toContain(
      "<LeftColumn wide={<UpstreamSidebar {...props} />} />",
    );
    expect(leftColumnSource).toMatch(
      /export function LeftColumn\([^)]*\) \{\s*\/\/[^\n]*\n\s*useZoomNotice\(\);/,
    );
  });
});

describe("the level's toast", () => {
  it("is upstream's, top right", () => {
    expect(toastSource).toMatch(
      /function ToastProvider\(\{ children, position = "top-right", \.\.\.props \}/,
    );
    expect(zoomNoticeSource).toMatch(/toastManager\.add\(\{\s*id: ZOOM_TOAST_ID,/);
  });

  it("added again under its id, updates in place and starts its timeout over", () => {
    expect(baseUiToastStore).toMatch(
      /const existingToast = selectors\.toast\(this\.state, toast\.id\);\s*if \(existingToast\) \{\s*if \(existingToast\.transitionStatus === 'ending'\) \{[\s\S]{0,200}\} else \{[\s\S]{0,200}this\.updateToastInternal\(toast\.id, updates, \{\s*resetTimer: true,/,
    );
  });

  it("finds its toast for Reduce Motion where upstream marks toasts", () => {
    expect(toastSource).toContain('data-slot="toast-viewport"');
    expect(toastSource).toMatch(/<Toast\.Root[\s\S]{0,6000}data-position=\{position\}/);
    expect(toastSource).toContain(
      "data-[position*=top]:data-[position*=right]:data-starting-style:transform-",
    );
    expect(zoomCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
