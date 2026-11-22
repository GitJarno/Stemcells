// @effect-diagnostics nodeBuiltinImport:off - reads and writes the shared catalog.
// The shared catalog the Mac and the phone read paths with is upstream's settings index as it
// is. When upstream adds, moves or renames a setting this fails; run it again with
// STEMCELLS_WRITE_CATALOG=1 to write the catalog, which the formatter then lays out.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { placeKey, placeOf, type SettingsPlace } from "../../../../../stemcells/settings/places.ts";
import { settingsCatalog } from "./settings";

const catalog = settingsCatalog();
const FILE = new URL("../../../../../stemcells/settings/catalog.json", import.meta.url);

describe("the settings catalog", () => {
  it("is upstream's settings index, written out", () => {
    if (process.env.STEMCELLS_WRITE_CATALOG === "1")
      NodeFS.writeFileSync(FILE, `${JSON.stringify(catalog, null, 2)}\n`);
    expect(JSON.parse(NodeFS.readFileSync(FILE, "utf8"))).toEqual(catalog);
  });

  it("names every place by a key a context link carries, and reads it back", () => {
    const places: SettingsPlace[] = [
      ...catalog.pages.map((page): SettingsPlace => ({ kind: "page", page: page.path })),
      ...catalog.rows.map((row): SettingsPlace => ({
        kind: "row",
        page: row.page,
        id: row.id,
        anchor: row.anchor ?? row.id,
      })),
      ...catalog.providers.map((provider): SettingsPlace => ({
        kind: "provider",
        page: "/settings/providers",
        driver: provider.driver,
      })),
    ];
    for (const place of places) {
      expect(placeKey(place)).toMatch(/^[a-z0-9_-]{1,128}$/i);
      expect(placeOf(placeKey(place), catalog)).toEqual(place);
    }
  });
});
