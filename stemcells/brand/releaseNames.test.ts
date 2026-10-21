import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";

import { describe, expect } from "vitest";

import { createBuildConfig } from "../../scripts/build-desktop-artifact.ts";
import { APP_NAME } from "./name.ts";

// The desktop build names its release files, and the Mac's permission prompts,
// after the app: people read both, in Finder and in macOS's own dialogs.

// Effect, and @effect/vitest that runs it, are the scripts package's, not the
// repo root's: load the copies the build script runs on.
const fromScripts = NodeModule.createRequire(
  new URL("../../scripts/package.json", import.meta.url),
);
const load = (id: string) => import(fromScripts.resolve(id));
const { it } = await load("@effect/vitest");
const Effect = await load("effect/Effect");
const ConfigProvider = await load("effect/ConfigProvider");
const NodeServices = await load("@effect/platform-node/NodeServices");

/** The Mac build's config, read with no environment set. */
const macBuildConfig = createBuildConfig(
  "mac",
  "dmg",
  "0.1.0",
  false,
  false,
  undefined,
  undefined,
).pipe(
  Effect.provide(NodeServices.layer),
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
);

// What electron-builder writes for an Apple silicon build.
const releaseFile = (artifactName: unknown, ext: string) =>
  String(artifactName)
    .replace("${version}", "0.1.0")
    .replace("${arch}", "arm64")
    .replace("${ext}", ext);

describe("the desktop release", () => {
  it.effect("names its files Stemcells-<version>-<arch>", () =>
    Effect.gen(function* () {
      const { artifactName } = yield* macBuildConfig;

      expect(releaseFile(artifactName, "dmg")).toBe(`${APP_NAME}-0.1.0-arm64.dmg`);
      expect(releaseFile(artifactName, "zip")).toBe(`${APP_NAME}-0.1.0-arm64.zip`);
    }),
  );

  it.effect("names files install-app finds", () =>
    Effect.gen(function* () {
      const { artifactName } = yield* macBuildConfig;
      const installApp = NodeFS.readFileSync(
        new URL("../scripts/install-app", import.meta.url),
        "utf8",
      );
      const glob = /ls -t release\/(\S+)/.exec(installApp)?.[1];
      expect(glob).toBeDefined();
      const pattern = new RegExp(
        `^${glob!.replace('"$arch"', "arm64").replace(/\./g, "\\.").replace(/\*/g, ".*")}$`,
      );

      expect(releaseFile(artifactName, "zip")).toMatch(pattern);
    }),
  );

  it.effect("names the app in every Mac permission prompt", () =>
    Effect.gen(function* () {
      const { mac } = yield* macBuildConfig;
      const info = (mac as { extendInfo: Record<string, unknown> }).extendInfo;
      const prompts = Object.entries(info).filter(([key]) => key.endsWith("UsageDescription"));

      expect(prompts.length).toBeGreaterThan(0);
      for (const [key, text] of prompts) {
        expect(text, key).toMatch(new RegExp(`^${APP_NAME} `));
        expect(text, key).not.toMatch(/T3 Code/);
      }
    }),
  );
});
