// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * Two of upstream's settings rows are never offered, and search skips both. "Collapse composer
 * on scroll" has nothing to turn on, as the composer never rests (`composerScrollGesture.ts`);
 * it is hidden by its anchor id. "Privacy policy" covers usage data Stemcells never sends; it is
 * drawn `hidden` (`privacyRow.browser.test.tsx` proves it takes no space and no focus).
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import settingsLayout from "../../../components/settings/settingsLayout.tsx?raw";
import settingsPanels from "../../../components/settings/SettingsPanels.tsx?raw";
import * as Upstream from "../../../components/settings/settingsSearch";
import { STEMCELLS_SETTINGS_LABELS } from "../../pages/settingsPages";
import {
  filterAvailableSettingsSearchItems,
  SETTINGS_NAV_GROUPS,
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

describe("Settings lists our pages in upstream's groups", () => {
  // Upstream's sidebar lists only what its groups name (#25651), and once took a path of ours
  // for a page of its own: each of our pages stands in the list once, beside all of upstream's.
  it("every page of ours, once, and every page of upstream's", () => {
    const listed = SETTINGS_NAV_GROUPS.flatMap((group) => group.paths);
    for (const path of Object.keys(STEMCELLS_SETTINGS_LABELS)) {
      expect(
        listed.filter((page) => page === path),
        path,
      ).toHaveLength(1);
    }
    for (const path of Upstream.SETTINGS_NAV_GROUPS.flatMap((group) => group.paths)) {
      expect(listed, path).toContain(path);
    }
    expect(SETTINGS_NAV_GROUPS.map((group) => group.heading)).toEqual(
      Upstream.SETTINGS_NAV_GROUPS.map((group) => group.heading),
    );
  });
});
