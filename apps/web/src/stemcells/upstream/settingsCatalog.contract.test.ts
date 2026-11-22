// The shared catalog the Mac and the phone read paths with is upstream's settings index as it
// is. When upstream adds, moves or renames a setting this fails; `vp test run -u` on this file
// writes the catalog again.
import { describe, expect, it } from "vite-plus/test";

import { placeKey, placeOf, type SettingsPlace } from "../../../../../stemcells/settings/places.ts";
import { settingsCatalog } from "./settings";

const catalog = settingsCatalog();

function written(): string {
  const lines = (entries: ReadonlyArray<object>) =>
    entries.map((entry) => `    ${JSON.stringify(entry)}`).join(",\n");
  return `{
  "pages": [
${lines(catalog.pages)}
  ],
  "rows": [
${lines(catalog.rows)}
  ],
  "providers": [
${lines(catalog.providers)}
  ]
}
`;
}

describe("the settings catalog", () => {
  it("is upstream's settings index, written out", async () => {
    await expect(written()).toMatchFileSnapshot("../../../../../stemcells/settings/catalog.json");
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
