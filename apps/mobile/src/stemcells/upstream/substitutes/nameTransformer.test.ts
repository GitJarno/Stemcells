// @effect-diagnostics nodeBuiltinImport:off - runs Metro's config and Expo's transformer on files on disk.
/**
 * The name transform on the phone (`nameTransformer.cjs`): its transformer says Stemcells where
 * upstream's code says T3 Code, and its serializer fails a bundle that says T3's name outside a
 * kept line's words. These run the config, the transformer and the serializer Metro runs.
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
  readonly nameCheckedSerializer: <S extends (...args: never[]) => unknown>(
    serializer: S,
  ) => (...args: unknown[]) => Promise<unknown>;
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
      readonly serializer: { readonly customSerializer: { readonly checksNames?: boolean } };
    };
    expect(config.transformer.babelTransformerPath).toBe(transformerPath);
    // Every bundle, however the phone is built, through the output check.
    expect(config.serializer.customSerializer.checksNames).toBe(true);
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

  it("fails a bundle whose code says T3's name outside a kept line's words", async () => {
    /** A bundle made of these modules (by their path from the phone), as Metro hands it to the serializer. */
    const serialize = (modules: Record<string, string | undefined>) =>
      transformer.nameCheckedSerializer(async () => "the bundle")(
        "index.js",
        [],
        {
          dependencies: new Map(
            Object.entries(modules).map(([file, code]) => [
              file,
              { path: NodePath.join(phoneRoot, file), output: [{ data: { code } }] },
            ]),
          ),
        },
        { projectRoot: phoneRoot },
      );
    // The bare name, from upstream's code or a dependency, named by its file.
    await expect(serialize({ "src/a.ts": 'var a="T3 Code";' })).rejects.toThrow(
      /src\/a\.ts: var a="T3 Code"/,
    );
    await expect(
      serialize({ "../../node_modules/x/index.js": 'x({title:"T3 Code"})' }),
    ).rejects.toThrow(/outside its files' kept words/);
    await expect(serialize({ "src/a.ts": undefined })).rejects.toThrow(/no code to check/);
    // T3's own theme, kept in its own file, beside our name; the same words
    // from another file are not.
    const theme = '[{id:a,label:"T3 Code"},{id:"material-you",label:"Material You"}]';
    await expect(
      serialize({ "src/lib/mobileTheme.ts": theme, "src/b.ts": `x("${APP_NAME}")` }),
    ).resolves.toBe("the bundle");
    await expect(serialize({ "src/lib/otherTheme.ts": theme })).rejects.toThrow(/otherTheme\.ts/);
    // The WebView scripts, already built and checked by module, are checked
    // against every entry's words: kept ones pass, a bare name doesn't.
    await expect(
      serialize({ ".generated/preview-stream/index.js": 'x.annotate(T,"T3 Code Relay API")' }),
    ).resolves.toBe("the bundle");
    await expect(
      serialize({ ".generated/preview-stream/index.js": 'x("T3 Code")' }),
    ).rejects.toThrow(/preview-stream/);
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
