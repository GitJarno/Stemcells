// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * Two of upstream's settings rows are never offered. "Collapse composer on
 * scroll" has nothing to turn on in Stemcells: the composer never rests
 * (`composerScrollGesture.ts`); its row is hidden by the anchor id upstream's
 * row carries. "Privacy policy" accounts for usage data Stemcells never
 * sends; its row is drawn `hidden` (`privacyRow.browser.test.tsx` proves it
 * takes no space and no focus). Search skips both.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import settingsLayout from "../../../components/settings/settingsLayout.tsx?raw";
import settingsPanels from "../../../components/settings/SettingsPanels.tsx?raw";
import * as Upstream from "../../../components/settings/settingsSearch";
import {
  filterAvailableSettingsSearchItems,
  searchableSetting,
  searchSettings,
} from "./settingsSearch";

/** CSS imports come in empty under test; the stylesheet is read as text. */
const css = NodeFS.readFileSync(new URL("./settingsSearch.css", import.meta.url), "utf8");

describe("Settings never offers the composer's collapse on scroll", () => {
  it("search skips it, where upstream's finds it", () => {
    const ids = (items: ReadonlyArray<{ readonly id: string }>) => items.map((item) => item.id);
    expect(ids(Upstream.searchSettings("collapse composer"))).toContain("composer-collapse");
    expect(ids(searchSettings("collapse composer"))).not.toContain("composer-collapse");
    expect(searchSettings("send shortcut").length).toBeGreaterThan(0);
  });

  it("its row is hidden by the anchor id upstream gives it", () => {
    expect(settingsPanels).toMatch(
      /<SettingsRow\s*\{\.\.\.searchableSetting\("composer-collapse"\)\}/,
    );
    // The row puts the id it's given and its slot on its root.
    expect(settingsLayout).toMatch(
      /<div\s*\{\.\.\.rowProps\}[\s\S]{0,200}?data-slot="settings-row"/,
    );
    expect(css).toContain('[data-slot="settings-row"]#composer-collapse {\n  display: none;');
  });
});

describe("Settings never offers upstream's privacy row", () => {
  const ids = (items: ReadonlyArray<{ readonly id: string }>) => items.map((item) => item.id);
  const everywhere = {
    hasCloudPublicConfig: true,
    hasEnvironment: true,
    hasProviderSettingsEnvironment: true,
    hasMacProviderSettingsEnvironment: true,
    canManageLocalBackend: true,
    isWslSettingsRowVisible: true,
    hasThreadAutoSettlement: true,
    managedTunnelActive: true,
  };

  it("search and the command palette skip it, where upstream's find it", () => {
    for (const query of ["privacy policy", "telemetry", "usage data"]) {
      expect(ids(Upstream.searchSettings(query)), query).toContain("privacy-policy");
      expect(ids(searchSettings(query)), query).not.toContain("privacy-policy");
    }
    expect(ids(Upstream.filterAvailableSettingsSearchItems(everywhere))).toContain(
      "privacy-policy",
    );
    expect(ids(filterAvailableSettingsSearchItems(everywhere))).not.toContain("privacy-policy");
    expect(ids(filterAvailableSettingsSearchItems(everywhere))).not.toContain("composer-collapse");
    expect(filterAvailableSettingsSearchItems(everywhere).length).toBeGreaterThan(20);
  });

  it("its row is drawn hidden, through the props upstream's row spreads on its root", () => {
    expect(searchableSetting("privacy-policy")).toEqual({
      ...Upstream.searchableSetting("privacy-policy"),
      hidden: true,
    });
    expect(searchableSetting("app-version")).toEqual(Upstream.searchableSetting("app-version"));
    expect(settingsPanels).toMatch(
      /<SettingsRow\s*\{\.\.\.searchableSetting\("privacy-policy"\)\}/,
    );
  });
});
