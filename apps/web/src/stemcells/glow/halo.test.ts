// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheets on disk.
/**
 * Only the composer's box is glass: the halo round the dock is a plain fade in the page's
 * colour and the Cell's ledge is solid, since a blur under either reads as a second pane. The
 * halo stops a short fade above the ledge, so it neither runs text under the line's words nor
 * dims a band over the Cell. What passes under the box blurs (the veil), only below its top.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

/** CSS imports come in empty under test; the stylesheets are read as text. */
const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
const glowCss = read("./glow.css");
const veilCss = read("./veil.css");
const lineCss = read("../composer/composer-line.css");
const perchCss = read("../aski/perch.css");
const dockCss = {
  "glow.css": glowCss,
  "cell.css": read("../cell/cell.css"),
  "perch.css": perchCss,
};

/** The rule a selector opens, up to its closing brace. */
const ruleOf = (css: string, selector: string) => {
  const start = css.indexOf(selector);
  return start < 0 ? "" : css.slice(start, css.indexOf("\n}", start));
};

/** The halo's rule: the ::before of the block upstream holds the line and the box in. */
const HALO = '[data-chat-composer-stack="true"] > :not(.bottom-full)::before {';
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

describe("the halo stops at the ledge, and what stands on the dock glows on its own", () => {
  it("stands its top a short fade over the ledge's top, or the box's where no ledge shows, never over the Cell", () => {
    // The block's own top is the Cell's head (or Aski's): the halo's top
    // follows the dock's top instead, through an anchor in the block.
    const halo = ruleOf(glowCss, HALO);
    expect(halo).toContain(
      "top: calc(anchor(--sc-dock-top top, 0px) - var(--sc-halo-reach) - var(--sc-halo-fade-top));",
    );
    expect(halo).toMatch(/to bottom,\s*transparent,\s*black var\(--sc-halo-fade-top\),/);
    const dockTop = ruleOf(
      glowCss,
      "[data-stemcells-pane] [data-stemcells-composer-line] .composer-line-ledge,",
    );
    expect(dockTop).toContain(
      '> :not(:has(.composer-line-ledge))\n  > [data-slot="composer-shell"] {\n  anchor-name: --sc-dock-top;',
    );
    expect(glowCss.match(/anchor-name/g)).toHaveLength(1);
  });

  it("the Cell, its buds and Aski wear the page's colour round their shape", () => {
    const glow = "filter: drop-shadow(0 0 var(--sc-figure-glow) var(--background))";
    expect(ruleOf(lineCss, ".composer-line-roof .character {")).toContain(glow);
    expect(ruleOf(perchCss, "[data-stemcells-aski-perch] {")).toContain(glow);
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
