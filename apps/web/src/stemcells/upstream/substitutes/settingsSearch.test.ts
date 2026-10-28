/**
 * Upstream's "Privacy policy" row covers usage data Stemcells never sends: search skips it, and
 * it is drawn `hidden` (`privacyRow.browser.test.tsx` proves it takes no space and no focus).
 */
import { describe, expect, it } from "vite-plus/test";

import settingsPanels from "../../../components/settings/SettingsPanels.tsx?raw";
import * as Upstream from "../../../components/settings/settingsSearch";
import { STEMCELLS_SETTINGS_LABELS } from "../../pages/settingsPages";
import {
  filterAvailableSettingsSearchItems,
  SETTINGS_NAV_GROUPS,
  searchableSetting,
  searchSettings,
} from "./settingsSearch";

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
  // Upstream's sidebar lists only what its groups name, and once took a path of ours for a
  // page of its own: each of our pages stands in the list once, beside all of upstream's.
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
