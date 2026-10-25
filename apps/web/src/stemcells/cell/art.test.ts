// @effect-diagnostics nodeBuiltinImport:off - reads the art's folder, as the kit's tools do.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { ART_MOVES, ART_PACKS, ART_TEMPERAMENTS, type ArtFiles } from "./art.ts";

const ART = new URL("./art/", import.meta.url);
const TABLES: Readonly<Record<string, ArtFiles>> = {
  moves: ART_MOVES,
  packs: ART_PACKS,
  temperaments: ART_TEMPERAMENTS,
};

describe("the art the kit reads", () => {
  it("is every file under art/, each by its name", () => {
    for (const folder of NodeFS.readdirSync(ART)) {
      const table = TABLES[folder];
      expect(table, `art/${folder} has no table in art.ts`).toBeDefined();
      const onDisk = Object.fromEntries(
        NodeFS.readdirSync(new URL(`${folder}/`, ART))
          .filter((name) => name.endsWith(".json"))
          .map((name) => [
            name.replace(/\.json$/, ""),
            JSON.parse(NodeFS.readFileSync(new URL(`${folder}/${name}`, ART), "utf8")) as unknown,
          ]),
      );
      expect(table).toEqual(onDisk);
    }
  });
});
