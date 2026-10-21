// @effect-diagnostics nodeBuiltinImport:off - reads upstream's source files on disk.
/**
 * What scrollbars.css relies on in upstream. A failure here after a sync
 * names the contract that moved: a bar may show at rest again and take
 * width out of the content, or show where upstream hid it.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import scrollArea from "../../components/ui/scroll-area.tsx?raw";

const webSource = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);

/** Upstream's web source, by path: everything under src/ but our folder and the tests. */
function readUpstreamFiles(): ReadonlyMap<string, string> {
  const files = new Map<string, string>();
  for (const entry of NodeFS.readdirSync(webSource, { recursive: true })) {
    const path = String(entry);
    if (path.startsWith(`stemcells${NodePath.sep}`)) continue;
    if (!/\.(?:tsx?|css)$/.test(path) || /\.test\.tsx?$/.test(path)) continue;
    files.set(path, NodeFS.readFileSync(NodePath.join(webSource, path), "utf8"));
  }
  return files;
}

const upstreamFiles = readUpstreamFiles();
// Read from disk: a stylesheet imported in a test comes back empty.
const indexCss = upstreamFiles.get("index.css")!;

/** The selectors of the CSS blocks in `css` that declare `property`. */
function selectorsDeclaring(css: string, property: string): string[] {
  const pattern = new RegExp(`([^{};]+)\\{[^{}]*\\b${property}\\s*:`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1]!.trim());
}

describe("scrollbars, against upstream", () => {
  it("upstream styles every element's ::-webkit-scrollbar, which makes Chromium draw a classic bar unless scrollbar-color is set", () => {
    expect(indexCss).toMatch(/^::-webkit-scrollbar \{\n {2}width: var\(--app-scrollbar-width\);/m);
  });

  it("nothing upstream sets scrollbar-color for the whole page, or back to auto, so the root's reaches every scroller", () => {
    for (const selector of selectorsDeclaring(indexCss, "scrollbar-color")) {
      expect(selector).not.toMatch(/^(?::root|html|body|\*)\b/);
    }
    for (const [path, source] of upstreamFiles) {
      expect(source, path).not.toMatch(/scrollbar-color\s*:\s*auto|\[scrollbar-color:auto\]/);
    }
  });

  it("upstream hides a bar with scrollbar-width: none wherever it hides ::-webkit-scrollbar, which scrollbar-color voids", () => {
    for (const [path, source] of upstreamFiles) {
      for (const line of source.split("\n")) {
        if (!line.includes("[&::-webkit-scrollbar]:hidden")) continue;
        expect(line, path).toContain("[scrollbar-width:none]");
      }
      expect(source, path).not.toMatch(/::-webkit-scrollbar\s*\{[^}]*display\s*:\s*none/);
    }
  });

  it("upstream's ScrollArea bar starts hidden and shows while scrolled or hovered, by data attributes", () => {
    expect(scrollArea).toContain('data-slot="scroll-area-scrollbar"');
    expect(scrollArea).toContain(
      '"flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:mx-1',
    );
    expect(scrollArea).toContain("data-hovering:opacity-100 data-scrolling:opacity-100");
  });
});
