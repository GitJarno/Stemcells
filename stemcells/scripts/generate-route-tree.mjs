// Writes apps/web/src/routeTree.gen.ts from the route files, as the web's Vite config does on
// every build: TanStack's generator, with the options vite.config.ts gives its plugin. A sync runs
// it instead of merging the file (sync-upstream, GENERATED).
//
//   node stemcells/scripts/generate-route-tree.mjs   (from the repository to write in)
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

// The generator is the router plugin's own dependency, so it is found from the plugin, which is
// found from the web app of the checkout this script is in.
const web = NodeModule.createRequire(new URL("../../apps/web/package.json", import.meta.url));
const plugin = NodeModule.createRequire(web.resolve("@tanstack/router-plugin/vite"));
const { Generator, getConfig } = await import(
  NodeURL.pathToFileURL(plugin.resolve("@tanstack/router-generator")).href
);

const root = NodePath.resolve("apps/web");
await new Generator({ config: getConfig({ autoCodeSplitting: true }, root), root }).run();
