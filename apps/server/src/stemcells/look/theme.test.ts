// @effect-diagnostics nodeBuiltinImport:off - reads our token sheet on disk.
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { STEMCELLS_THEME_COLORS } from "./theme.ts";

// The theme and Magma's desktop tokens are one ladder in two places; this
// fails when one moves without the other.

const SHEET = NodeURL.fileURLToPath(
  new URL("../../../../web/src/stemcells/tokens/stemcells.css", import.meta.url),
);

/** Magma's desktop block: `:root, [data-skin="magma"]`, before any device override. */
function magmaTokens(): ReadonlyMap<string, readonly [number, number, number, number]> {
  const sheet = NodeFS.readFileSync(SHEET, "utf8");
  const block = /:root,\s*\[data-skin="magma"\]\s*\{([^}]*)\}/.exec(sheet)?.[1];
  if (block === undefined) throw new Error("No Magma block in stemcells.css");
  const tokens = new Map<string, readonly [number, number, number, number]>();
  for (const [, name, r, g, b, a] of block.matchAll(
    /--sc-([a-z0-9-]+):\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g,
  )) {
    tokens.set(name!, [Number(r), Number(g), Number(b), Number(a)]);
  }
  return tokens;
}

const hex = (channels: ReadonlyArray<number>) =>
  `#${channels.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

function token(name: string) {
  const value = magmaTokens().get(name);
  if (value === undefined) throw new Error(`No --sc-${name} in Magma's block`);
  return value;
}

/** An opaque token as hex. */
const solid = (name: string) => {
  const [r, g, b, a] = token(name);
  expect(a, `--sc-${name} is opaque`).toBe(1);
  return hex([r, g, b]);
};

/** A translucent token laid over an opaque one, as the solid hex it shows. */
const over = (name: string, ground: string) => {
  const [r, g, b, a] = token(name);
  const [gr, gg, gb] = token(ground);
  return hex([r * a + gr * (1 - a), g * a + gg * (1 - a), b * a + gb * (1 - a)]);
};

describe("Stemcells' theme", () => {
  it("frames the slate in Magma's desktop ladder", () => {
    expect(STEMCELLS_THEME_COLORS.canvas).toBe(solid("plate"));
    expect(STEMCELLS_THEME_COLORS.toolbar).toBe(solid("plate"));
    expect(STEMCELLS_THEME_COLORS.chrome).toBe(solid("field"));
    expect(STEMCELLS_THEME_COLORS.sidebar).toBe(solid("field"));
    expect(STEMCELLS_THEME_COLORS.surface).toBe(solid("raised"));
    expect(STEMCELLS_THEME_COLORS.surfaceOverlay).toBe(solid("hot"));
    expect(STEMCELLS_THEME_COLORS.accent).toBe(solid("accent"));
    expect(STEMCELLS_THEME_COLORS.border).toBe(over("hairline", "plate"));
    expect(STEMCELLS_THEME_COLORS.sidebarBorder).toBe(over("hairline", "field"));
  });
});
