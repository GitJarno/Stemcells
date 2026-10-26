// @effect-diagnostics nodeBuiltinImport:off - reads style sheets from disk.
/**
 * What bold in a reply relies on upstream. A failure here after a sync
 * names the contract that moved: bold may read at the body's ink again, as
 * it did before, or step past the headings.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import chatMarkdown from "../../components/ChatMarkdown.tsx?raw";
import leftColumn from "../rail/LeftColumn.tsx?raw";

// Read from disk: a stylesheet imported in a test comes back empty.
const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
const indexCss = read("../../index.css");
const replyCss = read("../transcript/reply.css");
const tokensCss = read("../tokens/stemcells.css");

describe("bold in a reply, against upstream", () => {
  it("upstream sets a reply's body in its ink at 90 %, the step bold climbs", () => {
    expect(chatMarkdown).toContain(
      '"text-sm leading-relaxed text-foreground/[calc(90%+var(--appearance-contrast-boost)/10)]"',
    );
    expect(indexCss).toContain("--color-foreground: var(--contrast-foreground);");
  });

  it("upstream sets headings and inline code in that ink at full, where bold lands", () => {
    expect(indexCss).toMatch(
      /:is\(\.chat-markdown, \.composer-tiptap\) h6 \{\n {2}margin: [^}]*color: var\(--contrast-foreground\);\n\}/,
    );
    expect(indexCss).toMatch(
      /\.chat-markdown :not\(pre\) > code \{[^}]*color: var\(--contrast-foreground\);/,
    );
  });

  it("upstream leaves bold's colour alone, in its sheet and in how it renders a reply", () => {
    // Upstream sets bold's weight (`.chat-markdown strong`); no rule for it sets a colour.
    expect(indexCss).not.toMatch(/\bstrong\b[^{}]*\{[^}]*(?<![\w-])color\s*:/);
    expect(chatMarkdown).not.toContain("strong");
  });
});

describe("bold in a reply", () => {
  it("wears the ink of the words round it at full strength, in every chat", () => {
    expect(replyCss).toMatch(
      /\.chat-markdown :is\(strong, b\) \{\n {2}color: var\(--sc-strong-ink\);\n\}/,
    );
    expect(tokensCss).toContain("--sc-strong-ink: oklch(from currentcolor l c h / 1);");
    expect(leftColumn).toContain('import "../transcript/reply.css";');
  });
});
