import {
  T3_CODE_DARK_THEME_COLORS,
  type EnvironmentThemeFile,
  type ThemeColors,
} from "../upstream/theme.ts";

// Stemcells' look is T3's dark theme in a black frame: the window chrome and
// the sidebar are black, and the slate where the chat reads keeps T3's own
// colours. T3's sidebar roles are drawn for a black sidebar already, so its
// rows, hover and borders read on the frame as they are.

export const STEMCELLS_THEME_ID = "stemcells";

/** The frame: window chrome (the tab strip stands on it) and the sidebar. */
const FRAME = "#000000";

export const STEMCELLS_THEME_COLORS: ThemeColors = {
  ...T3_CODE_DARK_THEME_COLORS,
  chrome: FRAME,
  sidebar: FRAME,
};

/** The theme file Stemcells publishes: one dark palette, every role given. */
export const STEMCELLS_THEME_FILE: EnvironmentThemeFile = {
  version: 1,
  name: "Stemcells",
  appearance: "dark",
  colors: STEMCELLS_THEME_COLORS,
};

/** The file's bytes on disk; a published file that differs is replaced. */
export const STEMCELLS_THEME_JSON = `${JSON.stringify(STEMCELLS_THEME_FILE, null, 2)}\n`;
