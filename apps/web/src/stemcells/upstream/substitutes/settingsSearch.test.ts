// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheet on disk.
/**
 * "Collapse composer on scroll" has nothing to turn on in Stemcells: the
 * composer never rests (`composerScrollGesture.ts`). A setting that does
 * nothing must not be offered: search skips it, and its row is hidden by
 * the anchor id upstream's row carries.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import settingsLayout from "../../../components/settings/settingsLayout.tsx?raw";
import settingsPanels from "../../../components/settings/SettingsPanels.tsx?raw";
import * as Upstream from "../../../components/settings/settingsSearch";
import { searchSettings } from "./settingsSearch";

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
