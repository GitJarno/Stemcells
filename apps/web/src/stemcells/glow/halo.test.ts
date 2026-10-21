// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheets on disk.
/**
 * Only the composer's box is glass. The halo round the dock is a plain fade
 * in the page's colour and the Cell's ledge is solid: a blur under either
 * reads as a second pane of frosted glass round the line. The halo stopped
 * below the line once, so text ran on under the line's words and the Cell's
 * head; it covers them and fades out above. What passes under the box blurs
 * (the veil), and only below the box's top.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

/** CSS imports come in empty under test; the stylesheets are read as text. */
const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
const glowCss = read("./glow.css");
const veilCss = read("./veil.css");
const lineCss = read("../composer/composer-line.css");
const dockCss = {
  "glow.css": glowCss,
  "cell.css": read("../cell/cell.css"),
  "perch.css": read("../aski/perch.css"),
};

/** The rule a selector opens, up to its closing brace. */
const ruleOf = (css: string, selector: string) => {
  const start = css.indexOf(selector);
  return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
};

/** The halo's rule: the ::before of the block upstream holds the line and the box in. */
const HALO =
  '[data-chat-composer-stack="true"]\n  > :has(> [data-slot="composer-shell"])::before {';
const VEIL = '[data-stemcells-pane] [data-slot="composer-shell"]::after {';

describe("the halo covers the dock, never frosted", () => {
  it("is drawn on the block that holds the Cell's line and the box", () => {
    // upstream/composerLine.contract.test.ts pins that the line and the box
    // are that block's children.
    expect(glowCss).toContain(HALO);
    expect(glowCss).not.toMatch(/composer-shell"\]::(after|before)/);
  });

  it("is the page's colour, and nothing above the box is blurred", () => {
    expect(ruleOf(glowCss, HALO)).toContain("background: color-mix(in srgb, var(--background)");
    for (const [name, css] of Object.entries(dockCss))
      expect(css, name).not.toMatch(/backdrop-filter|\bblur\(/);
    // The ledge is upstream's tab, which frosts what is behind it: it turns
    // that off and blurs nothing of its own.
    expect(ruleOf(lineCss, ".composer-line-ledge::before {")).toContain("backdrop-filter: none;");
    expect(lineCss.match(/backdrop-filter: (?!none;)|\bblur\(/g)).toBeNull();
  });
});

describe("the veil blurs what passes under the box, only below its top", () => {
  it("is the box's own layer, starting inside the box and running down", () => {
    const veil = ruleOf(veilCss, VEIL);
    expect(veil).toContain("backdrop-filter: blur(var(--sc-veil-blur));");
    expect(veil).toMatch(/\btop: (?:[1-9]\d|100)%;/);
    expect(veilCss.match(/backdrop-filter/g)).toHaveLength(1);
  });
});
