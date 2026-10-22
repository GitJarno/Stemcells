// The name transform on the phone (`stemcells/brand/nameTransform.ts`): Metro
// hands every module to Expo's Babel transformer through this one, which
// first says Stemcells where upstream's code says T3 Code. CommonJS, because
// Metro loads a transformer with `require`; the transform itself is the web
// app's and the server's, loaded once per worker. It runs as Expo's does, in
// step: upstream's tests call Metro's transformer and read its result at
// once (`reactCompilerCoverage.test.ts`), so the transform is loaded with
// `require`, which Node (upstream's `engines`) takes TypeScript and ES
// modules through.
//
// `metro.config.js` sets this as Metro's `babelTransformerPath` in place of
// Expo's (`nameTransformer`, below). The phone's tests don't run Metro, so
// they see upstream's words, as on the web.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../../../../..");
const TRANSFORM_FILES = [
  path.join(repoRoot, "stemcells/brand/nameTransform.ts"),
  path.join(repoRoot, "stemcells/brand/name.ts"),
  __filename,
];

/** Expo's transformer, found the way Expo's own Metro config finds it. */
const EXPO_TRANSFORMER = require.resolve("@expo/metro-config/babel-transformer", {
  paths: [path.dirname(require.resolve("expo/metro-config"))],
});
const expo = require(EXPO_TRANSFORMER);

/** @type {typeof import("../../../../../../stemcells/brand/nameTransform.ts") | undefined} */
let nameTransform;

/** @param {{ filename: string, src: string, options: { projectRoot: string } }} props */
function transform(props) {
  nameTransform ??= require(TRANSFORM_FILES[0]);
  const { renameUpstreamName, UPSTREAM_NAME } = nameTransform;
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

module.exports = { ...expo, transform, getCacheKey, nameTransformer };
