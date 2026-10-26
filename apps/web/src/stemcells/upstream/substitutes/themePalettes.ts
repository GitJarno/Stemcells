// Replaces `@t3tools/shared/themePalettes` (`plugin.ts`) in the web: Stemcells' theme is built
// in (`../look.ts`), so it is reserved too, and the server's published copy is left out, not
// shown twice. `BUILT_IN_THEME_IDS` stays upstream's: the web reads built-ins from
// `BUILT_IN_THEMES`, and the server, on upstream's module, lists the ids it may not publish.
import {
  BUILT_IN_THEMES as UPSTREAM_BUILT_IN_THEMES,
  MOBILE_DEFAULT_THEME_ID,
  RESERVED_THEME_IDS as UPSTREAM_RESERVED_THEME_IDS,
  type ThemeDefinition,
} from "@t3tools/shared/themePalettes";

import { STEMCELLS_THEME } from "../look";

export * from "@t3tools/shared/themePalettes";

export const BUILT_IN_THEMES: ReadonlyArray<ThemeDefinition> = [
  STEMCELLS_THEME,
  ...UPSTREAM_BUILT_IN_THEMES,
];

export const RESERVED_THEME_IDS: ReadonlySet<string> = new Set([
  ...UPSTREAM_RESERVED_THEME_IDS,
  STEMCELLS_THEME.id,
]);

export const UNPUBLISHABLE_THEME_IDS: ReadonlySet<string> = new Set([
  ...RESERVED_THEME_IDS,
  MOBILE_DEFAULT_THEME_ID,
]);
