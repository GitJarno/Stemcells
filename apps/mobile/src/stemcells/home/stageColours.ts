// A row's stage as an adaptive token: T3's colour in light, the Mac's in dark (`../tokens.ts`),
// and a feat's rarity. Upstream's theme generator adds these to its adaptive colours (a seam),
// under Node.
import tailwindColors from "tailwindcss/colors";

import { DONE, NEEDS_YOU, WORKING } from "../tokens.ts";

// Lowercase, as the formatter writes hex in the generated sheet.
const dark = (hex: string) => hex.toLowerCase();

type Adaptive = Readonly<Record<string, readonly [light: string, dark: string]>>;

// A feat's rarity, as the Mac's `--sc-rarity-*` (`apps/web/src/stemcells/tokens/stemcells.css`).
const RARITY_COLOURS: Adaptive = {
  "--color-rarity-rare": [tailwindColors.blue[600], tailwindColors.blue[400]],
  "--color-rarity-legendary": [tailwindColors.orange[700], tailwindColors.orange[400]],
  "--color-rarity-secret": [tailwindColors.violet[600], tailwindColors.violet[400]],
};

export const STAGE_COLOURS: Adaptive = {
  "--color-stage-working": [tailwindColors.sky[600], dark(WORKING)],
  "--color-stage-input": [tailwindColors.indigo[600], dark(NEEDS_YOU)],
  "--color-stage-request": [tailwindColors.fuchsia[600], dark(NEEDS_YOU)],
  "--color-stage-done": [tailwindColors.emerald[700], dark(DONE)],
  ...RARITY_COLOURS,
};
