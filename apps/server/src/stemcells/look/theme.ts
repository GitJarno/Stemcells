import {
  T3_CODE_DARK_THEME_COLORS,
  type EnvironmentThemeFile,
  type ThemeColors,
} from "../upstream/theme.ts";

// Stemcells' look: a black frame (window chrome, sidebar) around a gray slate
// where the chat reads. The steps are Magma's desktop tokens in
// apps/web/src/stemcells/tokens/stemcells.css; theme.test.ts keeps the two
// equal. Roles the ladder doesn't name keep T3's dark values.

export const STEMCELLS_THEME_ID = "stemcells";

/** The frame: window chrome and sidebar (`--sc-field`). */
const FIELD = "#000000";
/** The slate the chat sits on (`--sc-plate`). */
const PLATE = "#0D0D0C";
/** Cards, code, inputs: one step up from the slate (`--sc-raised`). */
const RAISED = "#161514";
/** Overlays and hover over a raised step (`--sc-hot`). */
const HOT = "#201F1E";
/** `--sc-hairline` over the slate, as a solid colour. */
const HAIRLINE = "#272625";
/** `--sc-hairline` over the frame, as a solid colour. */
const FRAME_HAIRLINE = "#1D1C1C";
const ROW_HOVER = "#121211";
const ROW_ACTIVE = RAISED;
const ROW_SELECTED = "#1A1918";

const TEXT = "#F5F4F3";
const MUTED = "#8A8987";
const PLACEHOLDER = "#676664";

const ACCENT = "#3D40EE";
const ACCENT_PRESSED = "#3330D6";
const ON_ACCENT = "#F5F4F3";
const ACCENT_INK = "#8393FF";

export const STEMCELLS_THEME_COLORS: ThemeColors = {
  ...T3_CODE_DARK_THEME_COLORS,
  canvas: PLATE,
  chrome: FIELD,
  // `toolbar` is each chat's header, inside the slate (T3 keeps it the canvas
  // too); the tab strip is our own and stands on the frame.
  toolbar: PLATE,
  toolbarForeground: TEXT,
  toolbarBorder: HAIRLINE,
  toolbarControl: RAISED,
  toolbarControlForeground: TEXT,
  toolbarControlHover: HOT,
  surface: RAISED,
  surfaceRaised: RAISED,
  surfaceOverlay: HOT,
  text: TEXT,
  textMuted: MUTED,
  border: HAIRLINE,
  input: RAISED,
  focus: ACCENT,
  accent: ACCENT,
  accentForeground: ON_ACCENT,
  secondary: RAISED,
  secondaryForeground: TEXT,
  muted: RAISED,
  mutedForeground: MUTED,
  placeholder: PLACEHOLDER,
  secondaryLabel: MUTED,
  iconMuted: MUTED,
  update: ACCENT,
  updateForeground: ACCENT_INK,
  accentSurface: HOT,
  accentSurfaceForeground: TEXT,
  messageSurface: RAISED,
  messageForeground: TEXT,
  messageAction: ACCENT,
  messageActionForeground: ON_ACCENT,
  messageActionHover: ACCENT_PRESSED,
  codeBackground: RAISED,
  codeForeground: TEXT,
  sidebar: FIELD,
  sidebarForeground: TEXT,
  sidebarMutedForeground: MUTED,
  sidebarControlSurface: ROW_HOVER,
  sidebarRowHover: ROW_HOVER,
  sidebarRowActive: ROW_ACTIVE,
  sidebarRowSelected: ROW_SELECTED,
  sidebarBorder: FRAME_HAIRLINE,
  terminalBackground: PLATE,
  terminalForeground: TEXT,
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
