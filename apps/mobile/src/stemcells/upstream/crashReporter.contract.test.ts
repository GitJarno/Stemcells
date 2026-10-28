import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Contract: the phone carries no crash reporter. Upstream's `expo-observe`, and the
 * `expo-app-metrics` it brings, stay out of the native build on both platforms, and upstream's
 * importers get a no-op (`substitutes/expo-observe.ts`). If this fails after a sync, a crash
 * reporter is back in the app: exclude it in `apps/mobile/package.json`'s autolinking.
 */

const phoneRoot = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../..",
);
const REPORTERS = ["expo-observe", "expo-app-metrics"];

function nativeModules(platform: "ios" | "android"): string[] {
  const output = NodeChildProcess.execFileSync(
    NodePath.join(phoneRoot, "node_modules/.bin/expo-modules-autolinking"),
    ["resolve", "-p", platform, "--json"],
    { cwd: phoneRoot, encoding: "utf8" },
  );
  const resolved: { modules: ReadonlyArray<{ packageName: string }> } = JSON.parse(output);
  return resolved.modules.map((module) => module.packageName);
}

describe("the phone's native build", () => {
  it.each(["ios", "android"] as const)("links no crash reporter on %s", (platform) => {
    const modules = nativeModules(platform);
    expect(modules.length).toBeGreaterThan(20);
    expect(modules.filter((name) => REPORTERS.includes(name))).toEqual([]);
  });
});
