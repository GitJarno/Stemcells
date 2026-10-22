// The name transform on the phone (`stemcells/brand/nameTransform.ts`): Metro
// hands every module to Expo's Babel transformer through this one, which
// first says Stemcells where upstream's code says T3 Code, and every bundle
// it writes passes through `nameCheckedSerializer`, which fails one with a
// module that says T3's name outside its own file's kept words. CommonJS,
// because Metro loads a transformer with `require`; the transform itself is
// the web app's and the server's, loaded once per worker. It runs as Expo's
// does, in step: upstream's tests call Metro's transformer and read its
// result at once (`reactCompilerCoverage.test.ts`), so the transform is
// loaded with `require`, which Node (upstream's `engines`) takes TypeScript
// and ES modules through.
//
// `metro.config.js` hands its config to `withNameTransform` (below), which
// sets this as Metro's `babelTransformerPath` in place of Expo's and wraps
// its serializer. The phone's tests don't run Metro, so they see upstream's
// words, as on the web.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../../../../..");
const TRANSFORM_FILES = [
  path.join(repoRoot, "stemcells/brand/nameTransform.ts"),
  path.join(repoRoot, "stemcells/brand/name.ts"),
  path.join(repoRoot, "stemcells/brand/upstreamName.ts"),
  __filename,
];

/** Expo's transformer, found the way Expo's own Metro config finds it. */
const EXPO_TRANSFORMER = require.resolve("@expo/metro-config/babel-transformer", {
  paths: [path.dirname(require.resolve("expo/metro-config"))],
});
const expo = require(EXPO_TRANSFORMER);

/** @type {typeof import("../../../../../../stemcells/brand/nameTransform.ts") | undefined} */
let nameTransform;

const loadNameTransform = () => (nameTransform ??= require(TRANSFORM_FILES[0]));

/** @param {{ filename: string, src: string, options: { projectRoot: string } }} props */
function transform(props) {
  const { renameUpstreamName, UPSTREAM_NAME } = loadNameTransform();
  const file = path
    .relative(repoRoot, path.resolve(props.options.projectRoot, props.filename))
    .split(path.sep)
    .join("/");
  const renamed = renameUpstreamName(file, props.src);
  if (renamed !== null && renamed.unkept.length > 0) {
    throw new Error(
      `${file} says "${UPSTREAM_NAME}" where the name transform can't rename it: ${renamed.unkept
        .map((line) => line.trim())
        .join(" | ")}. Keep it in stemcells/brand/nameTransform.ts (KEPT), with why.`,
    );
  }
  return expo.transform(renamed === null ? props : { ...props, src: renamed.code });
}

/** Expo's cache key, and the transform's own files: a change to its list reruns it. */
function getCacheKey(...args) {
  const hash = crypto.createHash("sha1");
  for (const file of TRANSFORM_FILES) hash.update(fs.readFileSync(file));
  return [expo.getCacheKey ? expo.getCacheKey(...args) : "", hash.digest("hex")].join("$");
}

/**
 * This transformer's path, for Metro's `babelTransformerPath`, in place of
 * `current`. Only Expo's can be wrapped: a config that moved to another
 * fails here rather than losing the rename.
 * @param {string} current
 */
function nameTransformer(current) {
  if (current !== EXPO_TRANSFORMER) {
    throw new Error(
      `The phone's Metro config uses ${current}; nameTransformer.cjs wraps Expo's (${EXPO_TRANSFORMER}).`,
    );
  }
  return __filename;
}

/**
 * The code a bundle is made of: each module's (by its path from the
 * repository), as Metro transformed and minified it, and the prelude before
 * them. A bundle is checked by its modules rather than its text because
 * `expo export` compiles the text to Hermes bytecode inside the serializer,
 * whose string table runs strings together.
 * @param {ReadonlyArray<unknown>} preModules
 * @param {{ dependencies: Map<string, unknown> }} graph
 * @returns {Array<[string, string]>}
 */
function bundledCode(preModules, graph) {
  return [...preModules, ...graph.dependencies.values()].flatMap((module) =>
    module.output.map((output) => {
      if (typeof output.data?.code !== "string") {
        throw new Error(`nameTransformer.cjs: ${module.path} has no code to check.`);
      }
      return [path.relative(repoRoot, module.path).split(path.sep).join("/"), output.data.code];
    }),
  );
}

/**
 * The WebView scripts, a Vite build's output already
 * (`scripts/generate-device-stream.mts`), whose own build checked each of
 * their modules against its file (`upstreamNamePlugin`): here they're one
 * module, checked against every entry's words, as an app's files are.
 */
const BUILT = /^apps\/mobile\/\.generated\/(?:device|preview)-stream\//;

/**
 * Metro's serializer, through the output check the web's and the server's
 * builds run (`unexplainedNames`): a bundle with a module that says "T3 Code"
 * outside its own file's kept words fails, however the phone is built (the
 * dev server, `expo export`, `expo run`, EAS), as each serializes through
 * here.
 * @template {(...args: any[]) => unknown} Serializer
 * @param {Serializer | null | undefined} serializer
 * @returns {Serializer}
 */
function nameCheckedSerializer(serializer) {
  if (typeof serializer !== "function") {
    throw new Error("The phone's Metro config has no serializer for nameTransformer.cjs to check.");
  }
  /** @param {Parameters<Serializer>} args */
  const checked = async (...args) => {
    const [, preModules, graph] = args;
    const { unexplainedNames, keptIn, KEPT, UPSTREAM_NAME } = loadNameTransform();
    const unexplained = bundledCode(preModules, graph).flatMap(([file, code]) =>
      code.includes(UPSTREAM_NAME)
        ? unexplainedNames(code, BUILT.test(file) ? KEPT : keptIn(file)).map(
            (words) => `${file}: ${words}`,
          )
        : [],
    );
    if (unexplained.length > 0) {
      throw new Error(
        `The phone's bundle says "${UPSTREAM_NAME}" outside its files' kept words (stemcells/brand/nameTransform.ts):\n  ${unexplained.join("\n  ")}`,
      );
    }
    return serializer(...args);
  };
  // Expo finds what it wrapped by the serializer's own properties.
  return /** @type {Serializer} */ (Object.assign(checked, serializer, { checksNames: true }));
}

/**
 * Metro's `config` with the name transform: every module through this
 * transformer, every bundle through the output check.
 * @param {{ transformer: { babelTransformerPath: string }, serializer: { customSerializer?: any } }} config
 */
function withNameTransform(config) {
  config.transformer.babelTransformerPath = nameTransformer(
    config.transformer.babelTransformerPath,
  );
  config.serializer.customSerializer = nameCheckedSerializer(config.serializer.customSerializer);
  return config;
}

module.exports = {
  ...expo,
  transform,
  getCacheKey,
  nameTransformer,
  nameCheckedSerializer,
  withNameTransform,
};
