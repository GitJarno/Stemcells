// @effect-diagnostics nodeBuiltinImport:off - reads upstream's stylesheet on disk.
/**
 * Upstream behaviour every page on the slate relies on (pages/frame.css,
 * pages/SettingsOnSlab.tsx). A failure here after a sync names the contract
 * that moved: a page likely fills the window again, its frame lost its
 * ground, or Settings took the left column back.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import appSidebarLayout from "../../components/AppSidebarLayout.tsx?raw";
import threadRouteView from "../../components/ThreadRouteView.tsx?raw";
import settingsSidebarNav from "../../components/settings/SettingsSidebarNav.tsx?raw";
import sidebar from "../../components/ui/sidebar.tsx?raw";
import settingsRoute from "../../routes/_chat.settings.tsx?raw";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const appStyles = NodeFS.readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const frameStyles = NodeFS.readFileSync(new URL("../pages/frame.css", import.meta.url), "utf8");

describe("a page is upstream's inset, which frame.css makes the slate", () => {
  it("the inset names itself, and stands positioned for the slate's edge", () => {
    expect(sidebar).toMatch(
      /"relative flex min-w-0 w-full flex-1 flex-col bg-background surface-grain",[\s\S]*?data-slot="sidebar-inset"/,
    );
  });

  it("it is a flex item of the wrapper, which is the window's height", () => {
    // frame.css gives it back its natural height, so it stretches to the
    // wrapper's less its margins.
    expect(sidebar).toContain('"group/sidebar-wrapper flex min-h-svh w-full"');
    expect(appSidebarLayout).toContain('className="h-dvh! min-h-0!"');
  });

  it("the frame behind it is upstream's wrapper, painted with upstream's grain token", () => {
    expect(sidebar).toMatch(
      /"group\/sidebar-wrapper flex[^"]*",[\s\S]*?data-slot="sidebar-wrapper"/,
    );
    expect(appStyles).toContain("--surface-grain: url(");
    expect(appStyles).toContain("--surface-grain-size:");
  });
});

describe("a pane's chat inside the workspace's slate", () => {
  it("is an inset of its own, which the slate's rules leave to fill its pane", () => {
    // Matched, it took the slate's margins and kept upstream's w-full: every
    // pane's chat sat 8px right of centre and 36px down.
    expect(threadRouteView).toMatch(
      /<SidebarInset\s+className="h-svh min-h-0 overflow-hidden overscroll-y-none md:h-dvh"\s+inert=\{background\}\s*>/,
    );
    const slateRules = frameStyles.match(/\[data-slot="sidebar-inset"\][^{]*\{/g) ?? [];
    expect(slateRules).toHaveLength(3);
    for (const rule of slateRules) {
      expect(rule).toContain(":not([data-stemcells-workspace], [data-stemcells-workspace] *)");
    }
  });
});

describe("Settings over the chat", () => {
  it("the app's sidebar keeps the left column on every page", () => {
    expect(appSidebarLayout).toMatch(
      /\{legacySidebarEnabled \? \(\s*<LegacyThreadSidebar routeReveal=\{sidebarRouteReveal\} \/>\s*\) : \(\s*<LeftColumn wide=\{<ThreadSidebar routeReveal=\{sidebarRouteReveal\} \/>\} \/>\s*\)\}/,
    );
    expect(appSidebarLayout).not.toContain("<SettingsSidebarNav");
  });

  it("the settings route lays its panel out in upstream's modal, its close and outlet inside", () => {
    expect(settingsRoute).toMatch(
      /<AppRouteModal label="Settings">\s*<SettingsOnSlab[\s\S]*?<AppRouteModalClose \/>[\s\S]*?<Outlet \/>[\s\S]*?<\/SettingsOnSlab>\s*<\/AppRouteModal>/,
    );
    expect(settingsRoute).not.toContain("<SettingsBreadcrumb");
  });

  it("upstream's section list takes the page it lights", () => {
    expect(settingsSidebarNav).toContain(
      "export function SettingsSidebarNav({ pathname }: { pathname: string })",
    );
  });
});
