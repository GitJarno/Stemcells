import {
  T3_CODE_DARK_THEME_COLORS,
  type EnvironmentThemeFile,
  type ThemeColors,
} from "../upstream/theme.ts";

// Stemcells' look is T3's dark theme in a black frame, its slate a touch
// lighter than T3's chat so it stands apart from the frame. The window chrome
// and the sidebar are black. The slate is T3's canvas as it reads under T3's
// grain, laid flat, as T3 lays its chat. What stands on the slate (cards, the
// composer, code, popovers, the needs cards, hover) is T3's own colour for its
// role lifted with it, so each keeps the step above the slate it has above
// T3's. T3's sidebar roles are drawn for a black sidebar already, so its rows,
// hover and borders read on the frame as they are.

export const STEMCELLS_THEME_ID = "stemcells";

/** The frame: window chrome (the tab strip stands on it) and the sidebar. */
const FRAME = "#000000";

/**
 * The slate: T3's canvas (#0a0a0a) under T3's grain (`surface-grain`) reads
 * #0d0d0d on average, at 1x and at 2x. Its light is 1.33 times the canvas's,
 * and every role on it below is lifted by the same.
 */
const SLATE = "#0d0d0d";
/** T3's #111111 lifted: cards, the composer, code, popovers, controls. */
const RAISED = "#151515";
/** T3's #141414 lifted: hover, what is picked, your own messages. */
const HOT = "#181818";
/** T3's #191919 lifted: rules and outlines. */
const RULE = "#1e1e1e";
/** T3's #1e1e1e lifted: a field's edge. */
const FIELD_EDGE = "#232323";

export const STEMCELLS_THEME_COLORS: ThemeColors = {
  ...T3_CODE_DARK_THEME_COLORS,
  chrome: FRAME,
  sidebar: FRAME,
  canvas: SLATE,
  toolbar: SLATE,
  terminalBackground: SLATE,
  surface: RAISED,
  surfaceRaised: RAISED,
  surfaceOverlay: RAISED,
  codeBackground: RAISED,
  secondary: RAISED,
  muted: RAISED,
  toolbarControl: RAISED,
  toolbarControlHover: HOT,
  accentSurface: HOT,
  messageSurface: HOT,
  border: RULE,
  toolbarBorder: RULE,
  input: FIELD_EDGE,
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
