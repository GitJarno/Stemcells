// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and runs the phone's build config.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { APP_NAME as WEB_APP_NAME } from "../../../../web/src/stemcells/brand/name";
import { APP_NAME } from "../brand/name";
import { SUBSTITUTES } from "./substitutes/substitutes.cjs";

/**
 * Contract: the phone shows no T3 mark. Its icon, splash, Android art and Live Activity logo
 * are ours on every channel, and no upstream view it runs draws T3's wordmark or image unless
 * we substitute that view. If this fails after a sync, upstream added or moved a mark: give
 * it ours (`stemcells/seams.md`, "Stemcells' mark").
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../..");
const phoneRoot = NodePath.join(repoRoot, "apps/mobile");
const brandDir = NodePath.join(repoRoot, "stemcells/brand");

/** T3's wordmark, as upstream's views draw it: the start of its path. */
const T3_WORDMARK_PATH = "M33.4509 93V47.56H15.5309V37H64.3309";
/** Upstream's brand images, by folder (`assets/prod/black-ios-1024.png`). */
const T3_BRAND_IMAGES = /assets\/(?:dev|nightly|prod)\//;
const IMAGE = /\.(?:png|jpe?g|svg|ico|icon)$/;

/** Every image file a config names, wherever it names it. */
function imagesIn(value: unknown): string[] {
  if (typeof value === "string") return IMAGE.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(imagesIn);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(imagesIn);
  return [];
}

async function phoneConfig(channel: string): Promise<Record<string, unknown>> {
  vi.stubEnv("APP_VARIANT", channel);
  vi.resetModules();
  const module = (await import(NodePath.join(phoneRoot, "app.config.ts"))) as {
    readonly default: Record<string, unknown>;
  };
  return module.default;
}

function sourcesUnder(dir: string): string[] {
  return NodeFS.readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(?:tsx?|cjs|js)$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => NodePath.join(dir, file));
}

describe("the phone shows no T3 mark", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["development", "preview", "production"])(
    "the %s build's icon, splash and Android art are ours",
    async (channel) => {
      const config = await phoneConfig(channel);
      expect((config.extra as { readonly appVariant: string }).appVariant).toBe(channel);
      const images = imagesIn(config);
      expect(images.length).toBeGreaterThan(5);
      for (const image of images) {
        const file = NodePath.resolve(phoneRoot, image);
        expect(NodePath.relative(brandDir, file).startsWith(".."), image).toBe(false);
        expect(NodeFS.existsSync(file), image).toBe(true);
      }
      const android = config.android as {
        readonly adaptiveIcon: Readonly<Record<string, unknown>>;
      };
      expect(android.adaptiveIcon.backgroundColor).toBe("#000000");
      expect(android.adaptiveIcon.backgroundImage).toBeUndefined();
    },
  );

  it("the Live Activity's logo is ours", () => {
    // The widget plugin copies its logo from this path (one seam). Running the
    // plugin loads Expo's Xcode tooling, seconds a run, so this reads the line.
    const plugin = NodeFS.readFileSync(
      NodePath.join(phoneRoot, "plugins/withWidgetLogoAsset.cjs"),
      "utf8",
    );
    const sources = [...plugin.matchAll(/const source = path\.join\(__dirname, "([^"]+)"\);/g)];
    const pluginDir = NodePath.join(phoneRoot, "plugins");
    expect(sources.map((match) => NodePath.resolve(pluginDir, match[1]!))).toEqual([
      NodePath.join(brandDir, "phone-widget-mark.svg"),
    ]);
  });

  it("no upstream view draws T3's wordmark or shows T3's images, unless we substitute it", () => {
    const substituted = new Set(
      Object.keys(SUBSTITUTES).map((upstream) => NodePath.join(repoRoot, upstream)),
    );
    const ours = NodePath.join(phoneRoot, "src/stemcells");
    const offenders = sourcesUnder(NodePath.join(phoneRoot, "src"))
      .filter((file) => !file.startsWith(ours + NodePath.sep) && !substituted.has(file))
      .filter((file) => {
        const source = NodeFS.readFileSync(file, "utf8");
        return source.includes(T3_WORDMARK_PATH) || T3_BRAND_IMAGES.test(source);
      })
      .map((file) => NodePath.relative(repoRoot, file));
    expect(offenders).toEqual([]);
  });

  it("names the app as the web does", () => {
    expect(APP_NAME).toBe(WEB_APP_NAME);
  });
});
