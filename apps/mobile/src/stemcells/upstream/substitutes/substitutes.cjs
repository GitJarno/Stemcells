// The phone's substitutes for upstream modules, as the web's (`apps/web/src/stemcells/upstream/
// substitutes/plugin.ts`); CommonJS for Metro's `require`. Only upstream's own files get the
// same-named module in this folder, never a package's or ours, so a substitute can re-export
// what it replaces. A package is named as upstream imports it.
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
  // T3's own tools in the work log say Cell, not thread.
  "packages/shared/src/t3McpToolPresentation.ts": "t3McpToolPresentation.ts",
  "packages/client-runtime/src/t3ToolSummary.ts": "t3ToolSummary.ts",
  // A subagent is a Subcell: one with no title of its own, and in the
  // background-work line, the line over those waiting on the person, a
  // workflow's count and the composer's pill.
  "packages/client-runtime/src/state/subagentDisplay.ts": "subagentDisplay.ts",
  "packages/client-runtime/src/state/threadExecution.ts": "threadExecution.ts",
  "packages/client-runtime/src/state/threads.ts": "threads.ts",
  "packages/client-runtime/src/state/subagentRuntime.ts": "subagentRuntime.ts",
  "packages/client-runtime/src/state/threadSubagents.ts": "threadSubagents.ts",
  // The Cell heads its chat, beside its name; the feed fades under the
  // composer.
  "apps/mobile/src/features/threads/ThreadComposer.tsx": "ThreadComposer.tsx",
  "apps/mobile/src/features/threads/ThreadHeader.tsx": "ThreadHeader.tsx",
  "apps/mobile/src/features/threads/useThreadHeaderOptions.tsx": "useThreadHeaderOptions.tsx",
  // A chat's header, and the home's, float over what scrolls, no band behind
  // them; what scrolls fades into the ground under them.
  "apps/mobile/src/features/threads/thread-header-appearance.ts": "thread-header-appearance.ts",
  "apps/mobile/src/native/NativeScrollViewMarker.tsx": "NativeScrollViewMarker.tsx",
  // The home: one tab of Cells at a time under Aski, in cards, each tab's
  // shelves open.
  "apps/mobile/src/features/home/HomeScreen.tsx": "HomeScreen.tsx",
  "apps/mobile/src/features/home/ThreadListFilters.tsx": "ThreadListFilters.tsx",
  // The header says Cells while the phone loads or syncs them.
  "apps/mobile/src/features/home/workspace-connection-status.ts": "workspace-connection-status.ts",
  "apps/mobile/src/features/threads/thread-list-v2-row-appearance.ts":
    "thread-list-v2-row-appearance.ts",
  // A flying Cell's card reads at full contrast: its segment and its light say it flies.
  "apps/mobile/src/features/threads/thread-row-emphasis.ts": "thread-row-emphasis.ts",
  "apps/mobile/src/features/threads/use-thread-list-v2-shelf-preferences.ts":
    "use-thread-list-v2-shelf-preferences.ts",
  // The usage chart is the Mac's, a smoothed line per agent over a faint fill,
  // and an agent whose Cells wear a body of their own is drawn in its colour.
  "apps/mobile/src/features/usage/UsageDailyChart.ios.tsx": "UsageDailyChart.tsx",
  "apps/mobile/src/features/usage/UsageDailyChart.tsx": "UsageDailyChart.tsx",
  "apps/mobile/src/features/usage/usageProviders.ts": "usageProviders.ts",
  // The + opens Add to Chat: your photos, the camera first, picks in order.
  "apps/mobile/src/features/threads/ComposerAttachmentButton.tsx": "ComposerAttachmentButton.tsx",
  // A message's picture and video chips read "Image 1", "Video 2", as on the Mac.
  "apps/mobile/src/lib/enrichedLinkPresentation.ts": "enrichedLinkPresentation.ts",
  "apps/mobile/src/features/threads/ThreadDetailScreen.tsx": "ThreadDetailScreen.tsx",
  "apps/mobile/src/native/SelectableMarkdownText.tsx": "SelectableMarkdownText.tsx",
  "apps/mobile/src/features/threads/floating-working-control.tsx": "floating-working-control.tsx",
};

/** Package upstream's code imports, by name, to its substitute in this folder. */
const PACKAGES = {
  // The photos picked on Add to Chat reach T3's photo picking as its
  // picker's own.
  "expo-image-picker": "expo-image-picker.ts",
  // T3's crash reporter records nothing, and sends nothing.
  "expo-observe": "expo-observe.ts",
};

const repoRoot = path.resolve(__dirname, "../../../../../..");
const ourRoot = path.resolve(__dirname, "../..");
const nodeModules = `${path.sep}node_modules${path.sep}`;

const substituteOf = new Map(
  Object.entries(SUBSTITUTES).map(([upstream, ours]) => [
    path.join(repoRoot, upstream),
    path.join(__dirname, ours),
  ]),
);

/** @param {string} file */
const isOurs = (file) => file.startsWith(ourRoot + path.sep);

/**
 * The module `file` tests, without its extension, when `file` is a test.
 * @param {string} file
 */
const testOf = (file) => /^(.*)\.test\.[^./]+$/.exec(file)?.[1];

/**
 * The substitute for package `name` imported from `file`, when `file` is upstream's.
 * @param {string} name
 * @param {string} file
 */
const packageSubstitute = (name, file) => {
  const ours = Object.hasOwn(PACKAGES, name)
    ? PACKAGES[/** @type {keyof typeof PACKAGES} */ (name)]
    : undefined;
  return ours === undefined || isOurs(file) || file.includes(nodeModules)
    ? undefined
    : path.join(__dirname, ours);
};

/**
 * Metro: wraps the config's `resolveRequest` (or Metro's) so upstream's importers get substitutes.
 * @template {(context: any, moduleName: string, platform: string | null) => any} Resolve
 * @param {Resolve | undefined} resolveRequest
 * @returns {Resolve}
 */
function substituteRequests(resolveRequest) {
  return /** @type {Resolve} */ (
    (context, moduleName, platform) => {
      const ours = packageSubstitute(moduleName, context.originModulePath);
      if (ours !== undefined) return { type: "sourceFile", filePath: ours };
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
      const ours = packageSubstitute(source, importer);
      if (ours !== undefined) return ours;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved === null || resolved.external) return resolved;
      // Upstream's test of a module tests upstream's module.
      if (testOf(importer) === resolved.id.replace(/\.[^./]+$/, "")) return resolved;
      return substituteOf.get(resolved.id) ?? resolved;
    },
  };
}

module.exports = { PACKAGES, SUBSTITUTES, substituteRequests, substituteUpstreamModules };
