// @effect-diagnostics nodeBuiltinImport:off - reads the phone's stylesheet and its font files.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { DM_SANS_ASCENT, DM_SANS_CAP } from "../project/titleMark";

/**
 * Contract: a title's project mark centres on the capitals of upstream's type, DM Sans, from
 * where they stand in its font files (`project/titleMark.ts`). If this fails after a sync,
 * upstream set titles in another font, or another cut of this one: read its metrics again.
 */

const mobileRoot = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../..",
);
const fonts = NodePath.dirname(
  NodeModule.createRequire(NodePath.join(mobileRoot, "package.json")).resolve(
    "@expo-google-fonts/dm-sans/package.json",
  ),
);

/** A TrueType file's cap height and ascender over its units per em (`head`, `OS/2`, `hhea`). */
function metricsOf(file: string) {
  const font = NodeFS.readFileSync(file);
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    tables.set(font.toString("latin1", at, at + 4), font.readUInt32BE(at + 8));
  }
  const unitsPerEm = font.readUInt16BE(tables.get("head")! + 18);
  return {
    cap: font.readInt16BE(tables.get("OS/2")! + 88) / unitsPerEm,
    ascent: font.readInt16BE(tables.get("hhea")! + 4) / unitsPerEm,
  };
}

describe("the type a title's mark centres on", () => {
  it("is DM Sans, as upstream's stylesheet names it", () => {
    const sheet = NodeFS.readFileSync(NodePath.join(mobileRoot, "global.css"), "utf8");
    expect(sheet).toContain('--font-sans: "DMSans-Regular";');
    expect(sheet).toContain('--font-medium: "DMSans-Medium";');
  });

  it("stands its capitals where the mark centres, in each weight a title wears", () => {
    for (const file of ["400Regular/DMSans_400Regular.ttf", "500Medium/DMSans_500Medium.ttf"]) {
      expect(metricsOf(NodePath.join(fonts, file)), file).toEqual({
        cap: DM_SANS_CAP,
        ascent: DM_SANS_ASCENT,
      });
    }
  });
});
