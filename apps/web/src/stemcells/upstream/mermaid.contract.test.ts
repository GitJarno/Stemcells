// @effect-diagnostics nodeBuiltinImport:off - reads style sheets and pele's build from disk.
/**
 * What a Mermaid diagram in a reply relies on upstream. Upstream draws them
 * with pele, which reads its colours, type and corners from `--pele-*`
 * variables. A failure here after a sync names what moved: a diagram may
 * fetch a link or a picture it names, stop following Stemcells' look, or
 * lose our corners.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import mermaidDiagram from "../../components/chat/MermaidDiagram.tsx?raw";
import leftColumn from "../rail/LeftColumn.tsx?raw";

// Read from disk: a stylesheet imported in a test comes back empty.
const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
const indexCss = read("../../index.css");
const replyCss = read("../transcript/reply.css");
const tokensCss = read("../tokens/stemcells.css");
const peleDist = NodePath.join(
  NodePath.dirname(NodeModule.createRequire(import.meta.url).resolve("pele/package.json")),
  "dist",
);
const peleBuild = NodeFS.readdirSync(peleDist, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith(".js"))
  .map((file) => NodeFS.readFileSync(NodePath.join(peleDist, file), "utf8"))
  .join("\n");

describe("a Mermaid diagram, against upstream", () => {
  it("is drawn with its links and pictures off, so it fetches nothing it names", () => {
    expect(mermaidDiagram).toMatch(/\.mount\([^)]*\{\s*links: false,\s*images: false,/);
  });

  it("takes its colours from the theme, which Stemcells' look sets", () => {
    expect(indexCss).toMatch(/\.pele \{\n {2}--pele-bg: var\(--background\);\n {2}--pele-fg: var\(--foreground\);/);
  });

  it("reads its corners from --pele-radius, where our sheet puts a chip's", () => {
    expect(peleBuild).toContain("var(--pele-radius,");
  });
});

describe("a Mermaid diagram", () => {
  it("has a chip's corners, in every chat", () => {
    expect(replyCss).toMatch(/\.pele \{\n {2}--pele-radius: var\(--sc-radius-chip\);\n\}/);
    expect(tokensCss).toMatch(/--sc-radius-chip: /);
    expect(leftColumn).toContain('import "../transcript/reply.css";');
  });
});
