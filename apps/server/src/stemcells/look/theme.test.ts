// @effect-diagnostics nodeBuiltinImport:off - reads our token sheet on disk.
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { T3_CODE_DARK_THEME_COLORS } from "../upstream/theme.ts";
import { STEMCELLS_THEME_COLORS } from "./theme.ts";

// Stemcells keeps T3's colours and blacks out only the frame; our tokens name
// T3's roles rather than colours of their own, so they can't drift from it.

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
  it("is T3's dark theme with a black frame", () => {
    const { chrome, sidebar, ...slate } = STEMCELLS_THEME_COLORS;
    const { chrome: _chrome, sidebar: _sidebar, ...t3Slate } = T3_CODE_DARK_THEME_COLORS;
    expect(slate).toEqual(t3Slate);
    expect([chrome, sidebar]).toEqual(["#000000", "#000000"]);
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
