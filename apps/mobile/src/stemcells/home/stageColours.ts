// A row's stage as an adaptive token: T3's colour in light, the Mac's in dark (`../tokens.ts`).
// Upstream's theme generator adds these to its adaptive colours (a seam), under Node.
import tailwindColors from "tailwindcss/colors";

import { DONE, NEEDS_YOU, WORKING } from "../tokens.ts";

// Lowercase, as the formatter writes hex in the generated sheet.
const dark = (hex: string) => hex.toLowerCase();

export const STAGE_COLOURS: Readonly<Record<string, readonly [light: string, dark: string]>> = {
  "--color-stage-working": [tailwindColors.sky[600], dark(WORKING)],
  "--color-stage-input": [tailwindColors.indigo[600], dark(NEEDS_YOU)],
  "--color-stage-request": [tailwindColors.fuchsia[600], dark(NEEDS_YOU)],
  "--color-stage-done": [tailwindColors.emerald[700], dark(DONE)],
};
