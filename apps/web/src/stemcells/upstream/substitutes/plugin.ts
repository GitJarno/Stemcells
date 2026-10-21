// @effect-diagnostics nodeBuiltinImport:off - a build plugin: it maps files on disk.
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import type { Plugin } from "vite-plus";

/**
 * Upstream modules Stemcells replaces at build time, each with the module of
 * the same name in this folder. Upstream's code imports them as it always has
 * and gets ours, so the upstream file that imports one stays untouched: no
 * seam. Our own folder still gets upstream's, which is how a substitute
 * re-exports the module it replaces and changes only what it must.
 *
 * Every build of the web app reads this: dev, the production build the
 * desktop app ships, and both test projects. `substitutes.contract.test.ts`
 * proves each one, and that every substitute exports what its upstream
 * module does.
 */
export const SUBSTITUTES: Readonly<Record<string, string>> = {
  // No favicon fetched: a link or a page shows the app's own mark.
  "packages/shared/src/favicon.ts": "favicon.ts",
  // Concise model names: the picker's update notice and a subagent's tooltip.
  "packages/client-runtime/src/providerUpdateRequiredModels.ts": "providerUpdateRequiredModels.ts",
  "packages/client-runtime/src/state/subagentDisplay.ts": "subagentDisplay.ts",
  // Concise model names: the naming helpers, and the subagent bar's own.
  "apps/web/src/components/chat/providerIconUtils.ts": "providerIconUtils.ts",
  "apps/web/src/components/chat/ProviderSubagentBar.tsx": "ProviderSubagentBar.tsx",
  // The auto-compact window: the context meter fills toward where it compacts.
  "apps/web/src/components/chat/ContextWindowMeter.tsx": "ContextWindowMeter.tsx",
  // The workbench: a pane's chat draws its panel and sheet at the tab's edge.
  "apps/web/src/components/RightPanelTabs.tsx": "RightPanelTabs.tsx",
  "apps/web/src/components/RightPanelSheet.tsx": "RightPanelSheet.tsx",
  // Smart prompting: the composer inks the words that set a new chat up.
  "apps/web/src/components/ComposerPromptEditor.tsx": "ComposerPromptEditor.tsx",
};

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const ourRoot = NodePath.resolve(here, "../..");

const substituteOf: ReadonlyMap<string, string> = new Map(
  Object.entries(SUBSTITUTES).map(([upstream, ours]) => [
    NodePath.join(repoRoot, upstream),
    NodePath.join(here, ours),
  ]),
);

const isOurs = (id: string) => id.startsWith(ourRoot + NodePath.sep);

/** Resolves upstream's imports of a substituted module to ours. */
export function substituteUpstreamModules(): Plugin {
  return {
    name: "stemcells:substitute-upstream-modules",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (importer === undefined || isOurs(importer)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved === null || resolved.external) return resolved;
      return substituteOf.get(resolved.id) ?? resolved;
    },
  };
}
