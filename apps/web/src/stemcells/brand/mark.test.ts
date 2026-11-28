// @effect-diagnostics nodeBuiltinImport:off - reads the brand's SVG files.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import {
  MARK_LETTERS,
  MARK_VIEW_BOX,
  WORDMARK,
  WORDMARK_VIEW_BOX,
} from "../../../../../stemcells/brand/mark.ts";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const brand = NodePath.resolve(here, "../../../../../stemcells/brand");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(brand, file), "utf8");
const pathOf = (file: string) => /\sd="([^"]+)"/.exec(read(file))?.[1];

const tightBox = (path: string) => {
  const pairs = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
  const xs = pairs.map(([x]) => x as number);
  const ys = pairs.map(([, y]) => y as number);
  const round = (n: number) => Number(n.toFixed(3));
  return [
    round(Math.min(...xs)),
    round(Math.min(...ys)),
    round(Math.max(...xs) - Math.min(...xs)),
    round(Math.max(...ys) - Math.min(...ys)),
  ].join(" ");
};

describe("Stemcells' marks", () => {
  it("are the brand files' own paths, never redrawn", () => {
    expect(MARK_LETTERS).toBe(pathOf("app-icon.icon/Assets/letters.svg"));
    expect(WORDMARK).toBe(pathOf("wordmark.svg"));
    expect(read("wordmark.svg")).toContain(`viewBox="${WORDMARK_VIEW_BOX}"`);
  });

  it("box each mark with no air around it", () => {
    expect(MARK_VIEW_BOX).toBe(tightBox(MARK_LETTERS));
    expect(WORDMARK_VIEW_BOX).toBe(tightBox(WORDMARK));
  });
});
