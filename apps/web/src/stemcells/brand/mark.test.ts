// @effect-diagnostics nodeBuiltinImport:off - reads the app icon's layers.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { MARK_CURSOR, MARK_LETTERS, MARK_VIEW_BOX } from "../../../../../stemcells/brand/mark.ts";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const layers = NodePath.resolve(here, "../../../../../stemcells/brand/app-icon.icon/Assets");
const pathOf = (layer: string) =>
  /\sd="([^"]+)"/.exec(NodeFS.readFileSync(NodePath.join(layers, layer), "utf8"))?.[1];

describe("Stemcells' mark", () => {
  it("is the app icon's own paths, never redrawn", () => {
    expect(MARK_LETTERS).toBe(pathOf("letters.svg"));
    expect(MARK_CURSOR).toBe(pathOf("cursor.svg"));
  });

  it("boxes the lockup: from the S's left edge to the cursor's right, cap to baseline", () => {
    const xs = [...`${MARK_LETTERS} ${MARK_CURSOR}`.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
    const [left, top, width, height] = MARK_VIEW_BOX.split(" ").map(Number) as [
      number,
      number,
      number,
      number,
    ];
    expect(Math.min(...xs.map((m) => Number(m[1])))).toBe(left);
    expect(Math.max(...xs.map((m) => Number(m[1])))).toBe(left + width);
    expect(Math.min(...xs.map((m) => Number(m[2])))).toBe(top);
    expect(Math.max(...xs.map((m) => Number(m[2])))).toBe(top + height);
  });
});
