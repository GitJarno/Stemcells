import { BUILT_IN_THEME_IDS, T3_CODE_LIGHT_THEME_COLORS } from "@t3tools/shared/themePalettes";
import { describe, expect, it } from "vite-plus/test";

import { STEMCELLS_OVER_T3_DARK } from "../../../../../stemcells/brand/look.ts";
import {
  DEFAULT_MOBILE_THEME_ID,
  getMobileThemeColors,
  getMobileThemeVariables,
} from "../../lib/mobileTheme";
import { readDefaultMobileThemeVariables } from "../../lib/mobileTheme.test-support";

/**
 * Contract: the phone's own theme in dark wears the Mac's look, from the one place it's written,
 * in the stylesheet uniwind paints and in the palette the terminal and HTML views read. If this
 * fails after a sync, `lib/mobileTheme.ts` stopped handing its theme to `upstream/look.ts`, or
 * the generated theme went stale (`vp run --filter @t3tools/mobile generate`).
 */
describe("the phone's look, against the Mac's", () => {
  it("takes every role the Mac sets, its sheets and pages on the slate", () => {
    const colors = getMobileThemeColors(DEFAULT_MOBILE_THEME_ID, "dark");
    const { chrome: _frame, ...roles } = STEMCELLS_OVER_T3_DARK;
    expect(colors).toMatchObject(roles);
    expect(colors.chrome).toBe(STEMCELLS_OVER_T3_DARK.canvas);
  });

  it("paints them: the slate, cards, rules, a field's edge, code and a row's hover", () => {
    const painted = readDefaultMobileThemeVariables("dark");
    expect(painted).toMatchObject({
      "--color-screen": STEMCELLS_OVER_T3_DARK.canvas,
      "--color-sheet-solid": STEMCELLS_OVER_T3_DARK.canvas,
      "--color-card": STEMCELLS_OVER_T3_DARK.surface,
      "--color-border": STEMCELLS_OVER_T3_DARK.border,
      "--color-header-border": STEMCELLS_OVER_T3_DARK.toolbarBorder,
      "--color-input-border": STEMCELLS_OVER_T3_DARK.input,
      "--color-md-code-bg": STEMCELLS_OVER_T3_DARK.codeBackground,
      "--color-row-hover": STEMCELLS_OVER_T3_DARK.toolbarControlHover,
    });
  });

  it("draws its hairlines at full strength, as the Mac does", () => {
    const painted = readDefaultMobileThemeVariables("dark");
    expect(painted["--color-border-subtle"]).toBe(STEMCELLS_OVER_T3_DARK.border);
    expect(painted["--color-separator"]).toBe(STEMCELLS_OVER_T3_DARK.border);
  });

  it("sets a reply under its bold and headings, and the interface's words above the muted", () => {
    const painted = readDefaultMobileThemeVariables("dark");
    // The foreground at 90 % and 83 % over the slate, as the web mixes them.
    expect(painted["--color-md-body"]).toBe("#dedede");
    expect(painted["--color-md-strong"]).toBe(painted["--color-foreground"]);
    expect(painted["--color-foreground-secondary"]).toBe("#cecece");
    expect(painted["--color-foreground-muted"]).not.toBe(painted["--color-foreground-secondary"]);
  });

  it("leaves the light theme and the named themes T3's", () => {
    expect(getMobileThemeColors(DEFAULT_MOBILE_THEME_ID, "light")).toBe(T3_CODE_LIGHT_THEME_COLORS);
    for (const themeId of BUILT_IN_THEME_IDS) {
      const variables = getMobileThemeVariables(themeId, "dark");
      expect(variables["--color-border-subtle"], themeId).not.toBe(variables["--color-border"]);
    }
  });
});
