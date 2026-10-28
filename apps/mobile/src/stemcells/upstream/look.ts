// Stemcells' look on the phone, as on the Mac (`stemcells/brand/look.ts`, the one place it's
// written), for the phone's own theme in dark: `lib/mobileTheme.ts` hands its palette and its
// variables here (a seam). The light theme and the named themes stay T3's. The theme generator
// runs this under Node, so every import names its file.
import {
  MOBILE_DEFAULT_THEME_ID,
  type ThemeAppearance,
  type ThemeColors,
} from "@t3tools/shared/themePalettes";

import { STEMCELLS_OVER_T3_DARK } from "../../../../../stemcells/brand/look.ts";
import type { MobileThemeVariables } from "../../lib/mobileTheme.ts";
import { INK } from "../tokens.ts";

/**
 * T3's dark palette with Stemcells' roles over it. The phone draws no frame round its slate:
 * its chrome is its sheets and pages, which T3 paints in the canvas, so they stay the slate.
 */
export function overT3Dark(colors: ThemeColors): ThemeColors {
  return { ...colors, ...STEMCELLS_OVER_T3_DARK, chrome: STEMCELLS_OVER_T3_DARK.canvas };
}

/**
 * The Mac's hairlines and inks: rules at full strength (T3's phone fades them to 70 % and 55 %,
 * which the slate swallows), a reply's words a step under its bold and headings, and the
 * interface's words a tier above the muted ones.
 */
export function withStemcellsInk(
  themeId: string,
  appearance: ThemeAppearance,
  variables: MobileThemeVariables,
): MobileThemeVariables {
  if (themeId !== MOBILE_DEFAULT_THEME_ID || appearance !== "dark") return variables;
  const ink = variables["--color-foreground"];
  const slate = variables["--color-screen"];
  return {
    ...variables,
    "--color-border-subtle": variables["--color-border"],
    "--color-separator": variables["--color-border"],
    "--color-md-body": over(ink, INK.reply, slate),
    "--color-foreground-secondary": over(ink, INK.interface, slate),
  };
}

/** `ink` at `share` over `ground`, opaque: native text and the theme's contrast checks read hex. */
function over(ink: string, share: number, ground: string): string {
  const channel = (color: string, index: number) =>
    Number.parseInt(color.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) =>
    Math.round(channel(ink, index) * share + channel(ground, index) * (1 - share)),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
