// @effect-diagnostics nodeBuiltinImport:off - reads and writes the shared catalog.
// The shared catalog the Mac and the phone read paths with is upstream's settings index and our
// rows. When upstream adds, moves or renames a setting this fails; run it again with
// STEMCELLS_WRITE_CATALOG=1 to write the catalog, which the formatter then lays out.
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import { withStemcellsName } from "../../../../../stemcells/brand/upstreamName.ts";
import { WORD_TABLE } from "../../../../../stemcells/brand/wordTable.ts";
import { BINDINGS, controlOf } from "../../../../../stemcells/settings/controls.ts";
import {
  placeKey,
  placeOf,
  type SettingsCatalog,
  type SettingsPlace,
} from "../../../../../stemcells/settings/places.ts";
import { OUR_ROWS } from "../settings/ourRows";
import { settingAst, settingsCatalog } from "./settings";

// In the words the app shows: its build says our name and words where upstream's titles say theirs.
const upstream = withStemcellsName(settingsCatalog());
const swaps = WORD_TABLE.filter(({ file }) => file.endsWith("/settings/settingsSearch.ts"));
const shown = (title: string) => {
  const swap = swaps.find(({ words }) => words.includes(`"${title}"`));
  return swap === undefined ? title : title.replace(swap.theirs, swap.ours);
};
const rows = upstream.rows.map((row) => ({ ...row, title: shown(row.title) }));
const catalog: SettingsCatalog = { ...upstream, rows: [...rows, ...OUR_ROWS] };
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

  it("binds a card's control to a row it has, and to a key with a switch or a choice", () => {
    const rows = new Set(catalog.rows.map((row) => row.id));
    for (const [id, binding] of Object.entries(BINDINGS)) {
      expect(rows, id).toContain(id);
      if (binding.store === "ours") continue;
      const ast = settingAst(binding.store, binding.key);
      expect(ast, `${id}: ${binding.key}`).not.toBeNull();
      expect(controlOf(ast!), `${id}: ${binding.key}`).not.toBeNull();
    }
  });
});
