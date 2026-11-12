/**
 * The app's name where a person reads it most: the sidebar's top-left and
 * the window's title. A failure here after a sync means upstream brought
 * "T3 Code" back to one of them; put the seam back on top
 * (`stemcells/seams.md`, "The app's name").
 */
import { describe, expect, it } from "vite-plus/test";

import appInitSource from "../../appInit.tsx?raw";
import {
  formatAppDisplayName,
  resolveServerBackedAppDisplayName,
  resolveWindowTitle,
} from "../../branding.logic";
import brandingSource from "../../branding.ts?raw";
import sidebarChromeSource from "../../components/sidebar/SidebarChrome.tsx?raw";
import indexHtmlSource from "../../../index.html?raw";
import desktopPackageSource from "../../../../desktop/package.json?raw";
import desktopEnvironmentSource from "../../../../desktop/src/app/DesktopEnvironment.ts?raw";
import desktopWindowSource from "../../../../desktop/src/window/DesktopWindow.ts?raw";
import webViteConfigSource from "../../../vite.config.ts?raw";
import substitutesPluginSource from "./substitutes/plugin.ts?raw";
import { renameUpstreamName } from "../../../../../stemcells/brand/nameTransform.ts";
import { APP_NAME } from "../brand/name";

/** What a build makes of an upstream file: our name where it says upstream's. */
const built = (file: string, source: string) => renameUpstreamName(file, source)?.code ?? source;

describe("the app's name", () => {
  it("is what the sidebar's top-left reads", () => {
    // Both the visible mark and the probe that measures its width.
    expect(sidebarChromeSource.match(/<SidebarWordmark \/>/g)).toHaveLength(2);
    // Upstream's link reads "T3 Code home"; the build says ours.
    const sidebarChrome = built(
      "apps/web/src/components/sidebar/SidebarChrome.tsx",
      sidebarChromeSource,
    );
    expect(sidebarChrome).not.toMatch(/T3Wordmark|T3 Code/);
    expect(sidebarChrome).toContain(`aria-label="${APP_NAME} home"`);
  });

  it("titles a browser's window, before and after the app loads", () => {
    // Upstream's branding names the app when no desktop app does (a
    // browser); the build says ours there (`stemcells/brand/nameTransform.ts`).
    const branding = built("apps/web/src/branding.ts", brandingSource);
    expect(branding).toContain(
      `export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "${APP_NAME}";`,
    );
    // From the app's start, the title is that name on the primary server's channel.
    expect(
      resolveServerBackedAppDisplayName({
        baseName: APP_NAME,
        fallbackDisplayName: APP_NAME,
        fallbackStageLabel: "Alpha",
        primaryServerVersion: "1.0.0-nightly.20261021.1",
      }),
    ).toBe(`${APP_NAME} (Nightly)`);
    expect(appInitSource).toMatch(
      /const title = resolveWindowTitle\(\{\s*appDisplayName: resolveServerBackedAppDisplayName\(\{\s*baseName: APP_BASE_NAME,/,
    );
    expect(appInitSource).toContain("if (document.title !== title) document.title = title;");
    expect(appInitSource).toMatch(
      /export function startAppServices\(\)[\s\S]*startDocumentTitle\(router\);/,
    );
    // With no thread open the title is the name; a browser's ends with it.
    const titled = { appDisplayName: APP_NAME, desktop: false } as const;
    expect(resolveWindowTitle({ ...titled, projectTitle: null, threadTitle: null })).toBe(APP_NAME);
    expect(resolveWindowTitle({ ...titled, projectTitle: "Website", threadTitle: "Fix" })).toBe(
      `Website / Fix - ${APP_NAME}`,
    );
    expect(appInitSource).not.toContain("T3 Code");
    // Before it loads, upstream's build stamps upstream's name and channel into the page's
    // title; our rename runs after it (`order: "post"`), so the page says ours.
    expect(webViteConfigSource).toContain(
      'const title = formatAppDisplayName({ baseName: "T3 Code", stageLabel });',
    );
    expect(webViteConfigSource).toContain(
      "return html.replace(/<title>[^<]*<\\/title>/, `<title>${title}</title>`);",
    );
    expect(substitutesPluginSource).toContain(
      'transformIndexHtml: { order: "post", handler: naming.transformIndexHtml },',
    );
    const stamped = indexHtmlSource.replace(
      /<title>[^<]*<\/title>/,
      `<title>${formatAppDisplayName({ baseName: "T3 Code", stageLabel: "Beta" })}</title>`,
    );
    const indexHtml = built("apps/web/index.html", stamped);
    expect(indexHtml).toContain(`<title>${APP_NAME} (Beta)</title>`);
    expect(indexHtml).not.toContain("T3 Code");
  });

  it("titles the desktop app's window, menu and About panel", () => {
    // The desktop names itself and hands the name to the web as its branding.
    expect(desktopEnvironmentSource).toContain(`const APP_BASE_NAME = "${APP_NAME}";`);
    expect((JSON.parse(desktopPackageSource) as { productName: string }).productName).toBe(
      APP_NAME,
    );
    // The window keeps that name whatever the page's title says.
    expect(desktopWindowSource).toContain("window.setTitle(environment.displayName);");
    expect(desktopWindowSource).not.toContain("T3 Code");
  });
});
