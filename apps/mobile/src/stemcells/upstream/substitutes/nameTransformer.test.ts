// @effect-diagnostics nodeBuiltinImport:off - runs Metro's config and Expo's transformer on files on disk.
/**
 * The name transform on the phone: Metro hands every module to Expo's Babel
 * transformer through `nameTransformer.cjs`, which says Stemcells where
 * upstream's code says T3 Code (`stemcells/brand/nameTransform.ts`). These
 * run the config and the transformer Metro runs.
 */
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

import { APP_NAME } from "../../brand/name";

const require = NodeModule.createRequire(import.meta.url);
const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const phoneRoot = NodePath.resolve(here, "../../../..");
const transformerPath = NodePath.join(here, "nameTransformer.cjs");

interface Transformer {
  readonly transform: (props: unknown) => Promise<{ readonly ast: unknown }>;
  readonly getCacheKey: (options: { readonly projectRoot: string }) => string;
  readonly nameTransformer: (current: string) => string;
}
const transformer = require(transformerPath) as Transformer;

/** Babel's printer, the copy Expo's transformer runs with. */
const babelRequire = NodeModule.createRequire(require.resolve("expo/metro-config"));
const generate = (
  babelRequire("@babel/generator") as { default: (ast: unknown) => { code: string } }
).default;

/** What Metro's build makes of a file, printed back to code. */
async function built(fileFromPhone: string): Promise<string> {
  const result = await transformer.transform({
    filename: fileFromPhone,
    src: NodeFS.readFileSync(NodePath.join(phoneRoot, fileFromPhone), "utf8"),
    options: {
      projectRoot: phoneRoot,
      dev: false,
      hot: false,
      platform: "ios",
      minify: false,
      publicPath: "/assets",
      type: "module",
      inlineRequires: false,
      unstable_transformProfile: "default",
      customTransformOptions: {},
    },
    plugins: [],
  });
  return generate(result.ast).code;
}

describe("the phone's build says Stemcells", () => {
  it("Metro's config runs every module through the name transformer", async () => {
    const config = (await require(NodePath.join(phoneRoot, "metro.config.js"))) as {
      readonly transformer: { readonly babelTransformerPath: string };
    };
    expect(config.transformer.babelTransformerPath).toBe(transformerPath);
  });

  it("in a screen's text and in the packages it shares, before Expo's transform", async () => {
    const feed = await built("src/features/threads/ThreadFeed.tsx");
    expect(feed).toContain(`Sent by ${APP_NAME}`);
    expect(feed).not.toContain("T3 Code");
    const hostFreeze = await built("../../packages/client-runtime/src/connection/hostFreeze.ts");
    expect(hostFreeze).toContain(`${APP_NAME} on \${`);
    expect(hostFreeze).not.toContain("T3 Code");
  });

  it("keeps what the list keeps: T3's own theme", async () => {
    expect(await built("src/lib/mobileTheme.ts")).toContain('label: "T3 Code"');
  });

  it("wraps only Expo's transformer, and reruns when the transform changes", () => {
    expect(() => transformer.nameTransformer("/elsewhere/babel-transformer.js")).toThrow(
      /wraps Expo's/,
    );
    const key = transformer.getCacheKey({ projectRoot: phoneRoot });
    expect(key).toBe(transformer.getCacheKey({ projectRoot: phoneRoot }));
    expect(key.split("$").at(-1)).toMatch(/^[0-9a-f]{40}$/);
  });
});
