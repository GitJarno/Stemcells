import {
  STEMCELLS_OVER_T3_DARK,
  STEMCELLS_THEME_ID,
  STEMCELLS_THEME_NAME,
} from "../../../../../stemcells/brand/look.ts";
import {
  T3_CODE_DARK_THEME_COLORS,
  type EnvironmentThemeFile,
  type ThemeColors,
} from "../upstream/theme.ts";

// Stemcells' look (`stemcells/brand/look.ts`, where its colours and their
// reasons are written), as the theme file the server publishes. The web
// wears it built in; the file is for any other client.

export { STEMCELLS_THEME_ID };

export const STEMCELLS_THEME_COLORS: ThemeColors = {
  ...T3_CODE_DARK_THEME_COLORS,
  ...STEMCELLS_OVER_T3_DARK,
};

/** The theme file Stemcells publishes: one dark palette, every role given. */
export const STEMCELLS_THEME_FILE: EnvironmentThemeFile = {
  version: 1,
  name: STEMCELLS_THEME_NAME,
  appearance: "dark",
  colors: STEMCELLS_THEME_COLORS,
};

/** The file's bytes on disk; a published file that differs is replaced. */
export const STEMCELLS_THEME_JSON = `${JSON.stringify(STEMCELLS_THEME_FILE, null, 2)}\n`;
