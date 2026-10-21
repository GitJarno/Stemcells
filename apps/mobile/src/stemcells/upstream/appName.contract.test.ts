// @effect-diagnostics nodeBuiltinImport:off - reads the phone's sources and runs its build config.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { APP_NAME } from "../brand/name";
import { SUBSTITUTES } from "./substitutes/substitutes.cjs";

/**
 * Contract: the phone says Stemcells where it said T3 Code: its name on the
 * home screen, its widgets, its permission prompts, and every screen's text.
 * Only the words change: its ids, schemes and bundle ids stay upstream's, or
 * an installed app and its pairing break. If this fails after a sync,
 * upstream wrote its name somewhere new: say `APP_NAME` there
 * (`stemcells/seams.md`, "The app's name").
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../..");
const phoneRoot = NodePath.join(repoRoot, "apps/mobile");
const UPSTREAM_NAME = "T3 Code";

/** Upstream's name, kept on purpose: the theme T3 made is called T3 Code, as on the web. */
const KEPT = new Set([
  'apps/mobile/src/lib/mobileTheme.ts: { id: DEFAULT_MOBILE_THEME_ID, label: "T3 Code" },',
]);

const CHANNELS = {
  development: { name: `${APP_NAME} Dev`, scheme: "t3code-dev", id: "com.t3tools.t3code.dev" },
  preview: {
    name: `${APP_NAME} Preview`,
    scheme: "t3code-preview",
    id: "com.t3tools.t3code.preview",
  },
  production: { name: APP_NAME, scheme: "t3code", id: "com.t3tools.t3code" },
} as const;

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
}

async function phoneConfig(channel: string) {
  vi.stubEnv("APP_VARIANT", channel);
  vi.resetModules();
  const module = (await import(NodePath.join(phoneRoot, "app.config.ts"))) as {
    readonly default: {
      readonly name: string;
      readonly scheme: string;
      readonly ios: { readonly bundleIdentifier: string };
      readonly android: { readonly package: string };
    };
  };
  return module.default;
}

describe("the phone's name", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.entries(CHANNELS))(
    "the %s build is called Stemcells everywhere, with upstream's ids",
    async (channel, expected) => {
      const config = await phoneConfig(channel);
      expect(config.name).toBe(expected.name);
      expect(stringsIn(config).filter((text) => text.includes(UPSTREAM_NAME))).toEqual([]);
      // What installs and pairing hang on stays upstream's.
      expect(config.scheme).toBe(expected.scheme);
      expect(config.ios.bundleIdentifier).toBe(expected.id);
      expect(config.android.package).toBe(expected.id);
    },
  );

  it("no screen's text says T3 Code", () => {
    const substituted = new Set(Object.keys(SUBSTITUTES));
    const src = NodePath.join(phoneRoot, "src");
    const said = NodeFS.readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(?:tsx?|js)$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => !file.startsWith(`stemcells${NodePath.sep}`))
      .map((file) => NodePath.relative(repoRoot, NodePath.join(src, file)))
      .filter((file) => !substituted.has(file))
      .flatMap((file) =>
        NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8")
          .split("\n")
          .filter((line) => line.includes(UPSTREAM_NAME))
          // Comments are for the people who read the code.
          .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
          .map((line) => `${file}: ${line.trim()}`),
      )
      .filter((line) => !KEPT.has(line));
    expect(said).toEqual([]);
  });
});
