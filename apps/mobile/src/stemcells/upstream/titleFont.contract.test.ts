// @effect-diagnostics nodeBuiltinImport:off - reads the phone's stylesheet and its font files.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it, vi } from "vite-plus/test";

import { TITLE_TYPE } from "../project/titleMark";

const platform = vi.hoisted(() => ({ OS: "ios" }));
vi.mock("react-native", () => ({ Platform: platform }));

/**
 * Contract: a title's project mark centres on the capitals of whichever face upstream's font
 * preference sets (`project/titleMark.ts`). If this fails after a sync, upstream offers another
 * face, or another cut of DM Sans: read its metrics and add them.
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
  it("is known for every face upstream's font preference sets, on each platform", async () => {
    for (const os of ["ios", "android"]) {
      platform.OS = os;
      vi.resetModules();
      const { MOBILE_FONT_FAMILIES } = await import("../../lib/fontFamilies");
      for (const families of Object.values(MOBILE_FONT_FAMILIES)) {
        expect(TITLE_TYPE, `${os}: ${families.regular}`).toHaveProperty([families.regular]);
      }
    }
  });

  it("stands its capitals where the mark centres, in each weight a title wears", () => {
    for (const file of ["400Regular/DMSans_400Regular.ttf", "500Medium/DMSans_500Medium.ttf"]) {
      expect(metricsOf(NodePath.join(fonts, file)), file).toEqual(TITLE_TYPE["DMSans-Regular"]);
    }
  });
});
