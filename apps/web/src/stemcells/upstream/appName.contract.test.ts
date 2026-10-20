/**
 * The app's name where a person reads it most: the sidebar's top-left and
 * the window's title. A failure here after a sync means upstream brought
 * "T3 Code" back to one of them; put the seam back on top
 * (`stemcells/seams.md`, "The app's name").
 */
import { describe, expect, it } from "vite-plus/test";

import { APP_BASE_NAME, APP_DISPLAY_NAME, APP_STAGE_LABEL } from "../../branding";
import { resolveServerBackedAppDisplayName } from "../../branding.logic";
import rootRouteSource from "../../routes/__root.tsx?raw";
import sidebarChromeSource from "../../components/sidebar/SidebarChrome.tsx?raw";
import indexHtmlSource from "../../../index.html?raw";
import desktopPackageSource from "../../../../desktop/package.json?raw";
import desktopEnvironmentSource from "../../../../desktop/src/app/DesktopEnvironment.ts?raw";
import desktopWindowSource from "../../../../desktop/src/window/DesktopWindow.ts?raw";
import { APP_NAME } from "../brand/name";

describe("the app's name", () => {
  it("is what the sidebar's top-left reads", () => {
    // Both the visible mark and the probe that measures its width.
    expect(sidebarChromeSource.match(/<SidebarWordmark \/>/g)).toHaveLength(2);
    expect(sidebarChromeSource).not.toMatch(/T3Wordmark|T3 Code/);
  });

  it("titles a browser's window, before and after the app loads", () => {
    expect(APP_BASE_NAME).toBe(APP_NAME);
    expect(APP_DISPLAY_NAME.startsWith(APP_NAME)).toBe(true);
    // The title follows the primary server's channel.
    expect(
      resolveServerBackedAppDisplayName({
        baseName: APP_BASE_NAME,
        fallbackDisplayName: APP_DISPLAY_NAME,
        fallbackStageLabel: APP_STAGE_LABEL,
        primaryServerVersion: "1.0.0-nightly.20261021.1",
      }),
    ).toBe(`${APP_NAME} (Nightly)`);
    expect(rootRouteSource).toContain("document.title = title;");
    expect(rootRouteSource).not.toContain("T3 Code");
    expect(indexHtmlSource).toContain(`<title>${APP_NAME} (Beta)</title>`);
    expect(indexHtmlSource).not.toContain("T3 Code");
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
