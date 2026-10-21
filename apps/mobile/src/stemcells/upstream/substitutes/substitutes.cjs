// The phone's substitutes for upstream modules: the web's
// (`apps/web/src/stemcells/upstream/substitutes/plugin.ts`), for Metro and the
// phone's tests. CommonJS, because Metro's config loads it with `require`.
//
// Upstream's code that imports one of these modules gets the module of the
// same name in this folder; our own folder still gets upstream's, so a
// substitute can re-export what it replaces. `substitutes.contract.test.ts`
// proves both builds and the exports.
const path = require("node:path");

/** Upstream module (from the repository's root) to its substitute in this folder. */
const SUBSTITUTES = {
  // No favicon fetched: a link or a page shows the app's own mark.
  "packages/shared/src/favicon.ts": "favicon.ts",
  // Stemcells' mark where T3's showed: the work log's glyph, the header's
  // name, the loading screen's icon and name.
  "apps/mobile/src/components/T3Wordmark.tsx": "T3Wordmark.tsx",
  "apps/mobile/src/components/CompactBrandTitle.tsx": "CompactBrandTitle.tsx",
  "apps/mobile/src/components/BrandMark.tsx": "BrandMark.tsx",
  "apps/mobile/src/components/brandAssets.ts": "brandAssets.ts",
};

const repoRoot = path.resolve(__dirname, "../../../../../..");
const ourRoot = path.resolve(__dirname, "../..");

const substituteOf = new Map(
  Object.entries(SUBSTITUTES).map(([upstream, ours]) => [
    path.join(repoRoot, upstream),
    path.join(__dirname, ours),
  ]),
);

/** @param {string} file */
const isOurs = (file) => file.startsWith(ourRoot + path.sep);

/**
 * Metro: wraps the config's `resolveRequest` (or Metro's own), handing
 * upstream's importers the substitute.
 * @template {(context: any, moduleName: string, platform: string | null) => any} Resolve
 * @param {Resolve | undefined} resolveRequest
 * @returns {Resolve}
 */
function substituteRequests(resolveRequest) {
  return /** @type {Resolve} */ (
    (context, moduleName, platform) => {
      const resolution = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
      if (resolution.type !== "sourceFile" || isOurs(context.originModulePath)) return resolution;
      const substitute = substituteOf.get(resolution.filePath);
      return substitute === undefined ? resolution : { type: "sourceFile", filePath: substitute };
    }
  );
}

/** Vite, for the phone's tests: the web's plugin, with this table. */
function substituteUpstreamModules() {
  return {
    name: "stemcells:substitute-upstream-modules",
    enforce: /** @type {const} */ ("pre"),
    /**
     * @this {{ resolve: (source: string, importer: string, options: object) => Promise<{ id: string, external?: unknown } | null> }}
     * @param {string} source
     * @param {string | undefined} importer
     * @param {object} options
     */
    async resolveId(source, importer, options) {
      if (importer === undefined || isOurs(importer)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved === null || resolved.external) return resolved;
      return substituteOf.get(resolved.id) ?? resolved;
    },
  };
}

module.exports = { SUBSTITUTES, substituteRequests, substituteUpstreamModules };
