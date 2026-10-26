import {
  T3_CODE_DARK_THEME_COLORS,
  type ThemeColors,
  type ThemeDefinition,
} from "@t3tools/shared/themePalettes";
import "culori/css";
import { converter, parse } from "culori/fn";

import {
  STEMCELLS_OVER_T3_DARK,
  STEMCELLS_THEME_ID,
  STEMCELLS_THEME_NAME,
} from "../../../../../stemcells/brand/look.ts";

// Built-ins are written in upstream's canonical `oklch(L C h)` form, as
// `toCanonicalThemeColor` (themePalette.ts) gives a published file's colours.
// That module loads this one through the built-ins, so it can't be called
// here; builtInTheme.contract.test.ts holds these to it.
const toOklch = converter("oklch");

function inOklch(colors: ThemeColors): ThemeColors {
  return Object.fromEntries(
    Object.entries(colors).map(([role, value]) => [role, oklchOf(value)]),
  ) as ThemeColors;
}

function oklchOf(value: string): string {
  const color = toOklch(parse(value));
  if (!color) throw new Error(`Stemcells' look has a colour CSS can't read: ${value}`);
  const chroma = Math.max(0, color.c ?? 0);
  const hue = chroma < 0.0000005 ? 0 : (((color.h ?? 0) % 360) + 360) % 360;
  const body = `${digits(Math.min(1, Math.max(0, color.l ?? 0)), 6)} ${digits(chroma, 6)} ${digits(hue, 3)}`;
  const alpha = color.alpha ?? 1;
  return alpha < 1 ? `oklch(${body} / ${digits(alpha, 4)})` : `oklch(${body})`;
}

function digits(value: number, precision: number): string {
  const rounded = Math.abs(value) < 10 ** -precision / 2 ? 0 : value;
  return rounded.toFixed(precision).replace(/(?:\.0+|(?:(\.[0-9]*?)0+))$/, "$1");
}

/**
 * Stemcells' look (`stemcells/brand/look.ts`) as a built-in theme, first among T3's
 * (`substitutes/themePalettes.ts`) and in Settings' list (`ThemeSettings.tsx`). Built in, it
 * resolves when the theme module loads, before the first frame, rather than on the server's
 * theme event with T3's stock palette painted until then.
 */
export const STEMCELLS_THEME: ThemeDefinition = {
  id: STEMCELLS_THEME_ID,
  label: STEMCELLS_THEME_NAME,
  appearance: "dark",
  colors: inOklch({ ...T3_CODE_DARK_THEME_COLORS, ...STEMCELLS_OVER_T3_DARK }),
};
