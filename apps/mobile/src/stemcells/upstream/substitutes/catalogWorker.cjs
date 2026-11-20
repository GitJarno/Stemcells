// Metro's worker on the phone: the one the config named before (uniwind's, running Expo's), with
// each translation catalog renamed first (`renameCatalog`): Metro bundles a `.json` past the Babel
// transformer (nameTransformer.cjs). Workers run in processes of their own, so the wrapped one's
// path rides in the transformer config Metro hands each.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { loadNameTransform, repoRoot, TRANSFORM_FILES } = require("./nameTransformer.cjs");

const INNER = "stemcellsCatalogInner";

/** @param {Record<string, unknown>} config */
function inner(config) {
  const worker = config[INNER];
  if (typeof worker !== "string") {
    throw new Error(`catalogWorker.cjs: Metro's transformer config has no ${INNER} to run.`);
  }
  return require(worker);
}

function transform(config, projectRoot, filename, data, options) {
  const file = path
    .relative(repoRoot, path.resolve(projectRoot, filename))
    .split(path.sep)
    .join("/");
  const catalog = loadNameTransform().renameCatalog(file, data.toString("utf8"));
  const read = catalog === null ? data : Buffer.from(catalog.code, "utf8");
  return inner(config).transform(config, projectRoot, filename, read, options);
}

/** The wrapped worker's cache key, and the transform's own files: a change to the rename reruns it. */
function getCacheKey(config, ...rest) {
  const worker = inner(config);
  const hash = crypto.createHash("sha1");
  hash.update(fs.readFileSync(require.resolve(config[INNER])));
  for (const file of TRANSFORM_FILES) hash.update(fs.readFileSync(file));
  return [worker.getCacheKey ? worker.getCacheKey(config, ...rest) : "", hash.digest("hex")].join(
    "$",
  );
}

/**
 * Metro's `config` with this worker in front of the one it names, which must be the last change
 * to `transformerPath` (uniwind sets its own).
 * @param {{ transformerPath: string, transformer: Record<string, unknown> }} config
 */
function withCatalogWorker(config) {
  config.transformer[INNER] = config.transformerPath;
  config.transformerPath = __filename;
  return config;
}

module.exports = { transform, getCacheKey, withCatalogWorker };
