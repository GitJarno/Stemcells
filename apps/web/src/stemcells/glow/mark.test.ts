// @effect-diagnostics nodeBuiltinImport:off - reads the stylesheets on disk.
/**
 * The provider's mark in a Cell's composer reads at a glance, not the near-invisible 1% contrast
 * it once had, and stays quieter than the placeholder (about 3:1 on dark glass). Its strength is
 * a token by role over the composer's own glass, so it holds whatever greys the glass wears.
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "vite-plus/test";

/** CSS imports come in empty under test; the stylesheets are read as text. */
const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../tokens/stemcells.css");
const glow = read("./glow.css");

describe("the provider's mark in the composer", () => {
  it("is the words' ink at 12% over the glass", () => {
    expect(tokens).toMatch(/--sc-composer-mark: 12%;/);
  });

  it("mixes over the composer's own glass, never a fixed colour", () => {
    const imprint = glow.slice(glow.indexOf("[data-stemcells-composer-glass] .glass-imprint {"));
    const colour = /\n\s+color: ([^;]+);/
      .exec(imprint)?.[1]
      ?.replaceAll(/\s+/g, " ")
      .replaceAll("( ", "(")
      .replaceAll(" )", ")");
    expect(colour).toBe(
      "color-mix(in srgb, var(--sc-text) var(--sc-composer-mark), var(--chat-composer-glass-surface))",
    );
  });
});
