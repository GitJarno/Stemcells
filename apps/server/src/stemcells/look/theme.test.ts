// @effect-diagnostics nodeBuiltinImport:off - reads our token sheet on disk.
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { T3_CODE_DARK_THEME_COLORS } from "../upstream/theme.ts";
import { STEMCELLS_THEME_COLORS } from "./theme.ts";

// Stemcells is T3's dark theme in a black frame, its slate a touch lighter
// and what stands on the slate lifted with it. Our tokens name T3's roles
// rather than colours of their own, so they can't drift from it.

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const SHEET = NodeURL.fileURLToPath(
  new URL("../../../../web/src/stemcells/tokens/stemcells.css", import.meta.url),
);

/** Magma's desktop block: `:root, [data-skin="magma"]`, before any device override. */
function magmaTokens(): ReadonlyMap<string, string> {
  const sheet = NodeFS.readFileSync(SHEET, "utf8");
  const block = /:root,\s*\[data-skin="magma"\]\s*\{([^}]*)\}/.exec(sheet)?.[1];
  if (block === undefined) throw new Error("No Magma block in stemcells.css");
  return new Map(
    [...block.matchAll(/--sc-([a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name!,
      value!.trim(),
    ]),
  );
}

describe("Stemcells' theme", () => {
  const colors = STEMCELLS_THEME_COLORS;
  const t3 = T3_CODE_DARK_THEME_COLORS;

  it("frames a slate in black, apart from it by more than T3's", () => {
    expect([colors.chrome, colors.sidebar]).toEqual(["#000000", "#000000"]);
    expect(contrast(colors.canvas, colors.chrome)).toBeGreaterThan(contrast(t3.canvas, "#000000"));
  });

  it("keeps what stands on the slate T3's step above it", () => {
    // Lifting the slate alone would sink T3's composer, cards and code into
    // it; each is lifted with it, so it stands as far above as in T3.
    for (const role of [
      "toolbar",
      "terminalBackground",
      "surface",
      "surfaceRaised",
      "surfaceOverlay",
      "codeBackground",
      "secondary",
      "muted",
      "toolbarControl",
      "toolbarControlHover",
      "accentSurface",
      "messageSurface",
      "border",
      "toolbarBorder",
      "input",
    ] as const) {
      const step = luminance(colors[role]) / luminance(colors.canvas);
      const t3Step = luminance(t3[role]) / luminance(t3.canvas);
      expect(step / t3Step, role).toBeCloseTo(1, 1);
    }
  });

  it("keeps text readable on the slate and on what stands on it", () => {
    expect(contrast(colors.text, colors.canvas)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.codeForeground, colors.codeBackground)).toBeGreaterThanOrEqual(7);
    for (const ground of [colors.canvas, colors.surface, colors.accentSurface]) {
      expect(contrast(colors.mutedForeground, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textMuted, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.placeholder, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puts our parts on T3's surfaces", () => {
    const tokens = magmaTokens();
    expect(tokens.get("field")).toBe("var(--app-chrome-background)");
    expect(tokens.get("plate")).toBe("var(--background)");
    expect(tokens.get("page")).toBe("var(--background)");
    expect(tokens.get("raised")).toBe("var(--card)");
    expect(tokens.get("text")).toBe("var(--foreground)");
  });
});
