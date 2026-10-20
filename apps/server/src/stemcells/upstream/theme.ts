import type { EnvironmentThemeFile } from "@t3tools/contracts";
import { T3_CODE_DARK_THEME_COLORS, type ThemeColors } from "@t3tools/shared/themePalettes";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import { publishThemeFile, writeDefaultTheme } from "../../cli/theme.ts";
import * as ServerConfig from "../../config.ts";
import { MAX_THEME_FILE_BYTES, readThemeFileGuarded } from "../../environmentTheme.ts";
import * as ServerSettings from "../../serverSettings.ts";

// What Stemcells' look takes from upstream: T3's dark palette, and the
// environment themes `t3 theme set` publishes and sets.

export { T3_CODE_DARK_THEME_COLORS };
export type { EnvironmentThemeFile, ThemeColors };

/** The theme published as `themeId`, as the server reads it; null when there is none. */
export const readPublishedTheme = Effect.fn(function* (themeId: string) {
  const { environmentThemesDir } = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return readThemeFileGuarded(
    path.join(environmentThemesDir, `${themeId}.json`),
    MAX_THEME_FILE_BYTES,
  );
});

/**
 * Publishes `contents` as `themeId` the way `t3 theme set` publishes a file:
 * checked as the server will read it back, staged under an exclusive name and
 * renamed into place, so nothing at the destination is written through.
 */
export const publishTheme = Effect.fn(function* (themeId: string, contents: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { environmentThemesDir } = yield* ServerConfig.ServerConfig;
  const source = path.join(
    yield* fs.makeTempDirectoryScoped({ prefix: "stemcells-theme-" }),
    `${themeId}.json`,
  );
  yield* fs.writeFileString(source, contents);
  const published = yield* publishThemeFile({
    themesDir: environmentThemesDir,
    filePath: source,
    explicitId: Option.some(themeId),
  });
  yield* published.cleanup;
}, Effect.scoped);

/**
 * Makes `themeId` the environment's theme, with a new set time, as `t3 theme
 * set` does, but only while none is set: a person's choice stays. Checked
 * under the settings service's write lock, so none of its own writes lands
 * between the check and this one.
 */
export const adoptDefaultThemeWhenUnset = Effect.fn(function* (themeId: string) {
  const { settingsPath } = yield* ServerConfig.ServerConfig;
  const settings = yield* ServerSettings.ServerSettingsService;
  return yield* settings.withSettingsSnapshot((current) =>
    current.defaultTheme.length > 0
      ? Effect.succeed(false)
      : writeDefaultTheme({ settingsPath, themeId }).pipe(Effect.as(true)),
  );
});
