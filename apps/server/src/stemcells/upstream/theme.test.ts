import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as TestClock from "effect/testing/TestClock";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import { writeDefaultTheme } from "../../cli/theme.ts";
import * as ServerConfig from "../../config.ts";
import { readPublishedThemes } from "../../environmentTheme.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { publishLook } from "../look/publish.ts";
import { STEMCELLS_THEME_FILE, STEMCELLS_THEME_JSON } from "../look/theme.ts";

// Contract: the theme Stemcells publishes on start is one the server reads
// back as an environment theme, and its first publish makes it the default
// through the same settings fields `t3 theme set` writes, only on a server
// with none.

/** One state folder, kept across the starts of a test. */
const layerStateFolder = () =>
  Layer.fresh(ServerConfig.layerTest(process.cwd(), { prefix: "stemcells-look-" }));

/** A server start: its own settings service, reading the folder anew. */
const start = publishLook.pipe(
  Effect.provide(
    Layer.fresh(
      ServerSettings.layer.pipe(
        Layer.provide(ServerSecretStore.layer),
        Layer.provide(SqlitePersistence.layerMemory),
      ),
    ),
  ),
);

const paths = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return {
    theme: path.join(config.environmentThemesDir, "stemcells.json"),
    themesDir: config.environmentThemesDir,
    settings: config.settingsPath,
  };
});

const readJson = Effect.fn(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return JSON.parse(yield* fs.readFileString(filePath)) as Record<string, unknown>;
});

it.layer(NodeServices.layer)("Stemcells' theme on start", (it) => {
  it.effect("publishes the theme and opens a fresh server on it, once", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const at = yield* paths;

      yield* start;
      assert.equal(yield* fs.readFileString(at.theme), STEMCELLS_THEME_JSON);
      const published = yield* readPublishedThemes(at.themesDir);
      assert.deepEqual(published, [{ id: "stemcells", ...STEMCELLS_THEME_FILE }]);
      const settings = yield* readJson(at.settings);
      assert.equal(settings.defaultTheme, "stemcells");
      assert.isNotEmpty(settings.defaultThemeSetAt);

      // A second start rewrites nothing: a new set time would have every
      // client re-apply the theme over its own choice.
      const themeBefore = yield* fs.stat(at.theme);
      const settingsBefore = yield* fs.readFileString(at.settings);
      yield* TestClock.adjust("1 minute");
      yield* start;
      assert.deepEqual((yield* fs.stat(at.theme)).ino, themeBefore.ino);
      assert.equal(yield* fs.readFileString(at.settings), settingsBefore);
    }).pipe(Effect.provide(layerStateFolder())),
  );

  it.effect("a cleared default stays cleared", () =>
    Effect.gen(function* () {
      const at = yield* paths;
      yield* start;
      // What `t3 theme clear` does.
      yield* writeDefaultTheme({ settingsPath: at.settings, themeId: "" });
      const cleared = yield* readJson(at.settings);
      assert.notProperty(cleared, "defaultTheme");

      yield* TestClock.adjust("1 minute");
      yield* start;
      assert.deepEqual(yield* readJson(at.settings), cleared);

      // Nor does a start that brings a new palette.
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString(
        at.theme,
        `${JSON.stringify({ ...STEMCELLS_THEME_FILE, name: "Stemcells, earlier" }, null, 2)}\n`,
      );
      yield* start;
      assert.equal(yield* fs.readFileString(at.theme), STEMCELLS_THEME_JSON);
      assert.deepEqual(yield* readJson(at.settings), cleared);
    }).pipe(Effect.provide(layerStateFolder())),
  );

  it.effect("keeps a default a person chose", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const at = yield* paths;
      const chosen = `${JSON.stringify(
        { defaultTheme: "ocean", defaultThemeSetAt: "2026-01-02T03:04:05.000Z" },
        null,
        2,
      )}\n`;
      yield* fs.writeFileString(at.settings, chosen);

      yield* start;
      assert.equal(yield* fs.readFileString(at.settings), chosen);
      assert.equal(yield* fs.readFileString(at.theme), STEMCELLS_THEME_JSON);
    }).pipe(Effect.provide(layerStateFolder())),
  );

  it.effect("replaces the published theme when Stemcells' palette changes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const at = yield* paths;
      const earlier = {
        ...STEMCELLS_THEME_FILE,
        colors: { ...STEMCELLS_THEME_FILE.colors, canvas: "#161616" },
      };
      yield* fs.makeDirectory(at.themesDir, { recursive: true });
      yield* fs.writeFileString(at.theme, `${JSON.stringify(earlier, null, 2)}\n`);
      const adopted = `${JSON.stringify(
        { defaultTheme: "stemcells", defaultThemeSetAt: "2026-01-02T03:04:05.000Z" },
        null,
        2,
      )}\n`;
      yield* fs.writeFileString(at.settings, adopted);

      yield* start;
      assert.equal(yield* fs.readFileString(at.theme), STEMCELLS_THEME_JSON);
      // Clients that use the theme take the new palette by its id; the set
      // time stays, so nobody's own choice is overridden.
      assert.equal(yield* fs.readFileString(at.settings), adopted);
    }).pipe(Effect.provide(layerStateFolder())),
  );
});
