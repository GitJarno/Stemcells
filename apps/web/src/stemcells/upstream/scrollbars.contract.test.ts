// @effect-diagnostics nodeBuiltinImport:off - reads upstream's source files on disk.
/**
 * What scrollbars.css relies on in upstream to draw no scroll bar anywhere.
 * A failure here after a sync names the contract that moved: a bar may
 * draw again over some scroller, or the terminal's may stop showing focus.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import scrollArea from "../../components/ui/scroll-area.tsx?raw";
import terminalSurface from "../../terminal/ghostty/surface.ts?raw";

const webRoot = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../..",
);
const webSource = NodePath.join(webRoot, "src");

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

/** A library's stylesheet as it ships, which it puts in the shadow roots it draws in. */
const libraryStyle = (name: string) =>
  NodeFS.readFileSync(NodePath.join(webRoot, "node_modules", name, "dist/style.js"), "utf8");

/** The selectors of the CSS blocks in `css` that declare `property`. */
function selectorsDeclaring(css: string, property: string): string[] {
  const pattern = new RegExp(`([^{};]+)\\{[^{}]*\\b${property}\\s*:`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1]!.trim());
}

describe("no scroll bars, against upstream", () => {
  it("nothing upstream asks for a bar with !important, which would outrank the sheet's", () => {
    for (const [path, source] of upstreamFiles) {
      expect(source, path).not.toMatch(/scrollbar-width\s*:[^;}\]]*!important/);
      expect(source, path).not.toMatch(/\[scrollbar-width:[^\]]*\]!/);
      expect(source, path).not.toMatch(/!\[scrollbar-width:/);
    }
  });

  it("upstream's ScrollArea draws its bars and corner under the attributes the sheet hides", () => {
    expect(scrollArea).toContain('data-slot="scroll-area-scrollbar"');
    expect(scrollArea).toContain('<ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />');
  });

  it("the terminal draws its bar as a focusable ARIA scrollbar, which the sheet shows only in focus", () => {
    expect(terminalSurface).toContain('scrollbar.setAttribute("role", "scrollbar");');
    expect(terminalSurface).toContain("scrollbar.tabIndex = 0;");
  });

  it("the diff and file-tree views size their shadow roots' bars by a property the page sets", () => {
    const diffs = libraryStyle("@pierre/diffs");
    expect(diffs).toContain("--diffs-scrollbar-gutter:var(--diffs-scrollbar-gutter-override,");
    expect(diffs).toContain(
      "[data-code]::-webkit-scrollbar{width:0;height:var(--diffs-scrollbar-gutter)}",
    );
    const trees = libraryStyle("@pierre/trees");
    expect(trees).toContain(
      "--trees-scrollbar-gutter: var(--trees-scrollbar-gutter-override, 6px)",
    );
    expect(trees).toMatch(
      /&::-webkit-scrollbar \{\\n\s+width: var\(--trees-scrollbar-gutter\);\\n\s+height: var\(--trees-scrollbar-gutter\);/,
    );
    for (const [path, source] of upstreamFiles) {
      expect(source, path).not.toMatch(/--(?:diffs|trees)-scrollbar-gutter-override/);
    }
  });

  it("nothing upstream sets scrollbar-color for the whole page, which would turn those views' bar rules off", () => {
    // scrollbar-color inherits into a shadow root, and Chromium ignores
    // ::-webkit-scrollbar rules where it is set.
    for (const selector of selectorsDeclaring(indexCss, "scrollbar-color")) {
      expect(selector).not.toMatch(/^(?::root|:host|html|body|\*)\b/);
    }
  });
});
