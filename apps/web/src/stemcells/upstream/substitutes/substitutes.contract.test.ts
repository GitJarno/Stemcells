// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and builds the app.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as UpstreamUpdateNotice from "@t3tools/client-runtime/providerUpdateRequiredModels";
import * as UpstreamSubagentDisplay from "@t3tools/client-runtime/state/subagent-display";
import * as UpstreamFavicon from "@t3tools/shared/favicon";
import { build, createServer, type ConfigEnv, type Plugin, type UserConfig } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import webConfig from "../../../../vite.config";
import * as UpstreamFaviconReexport from "../../../lib/favicon";
import * as OurFavicon from "./favicon";
import { SUBSTITUTES, substituteUpstreamModules } from "./plugin";
import * as OurUpdateNotice from "./providerUpdateRequiredModels";
import * as OurSubagentDisplay from "./subagentDisplay";

/**
 * Contract: every build of the web app hands upstream's code our substitute
 * for each module in `SUBSTITUTES`, and each substitute still exports what its
 * upstream module does. If this fails after a sync, upstream's views have
 * quietly gone back to upstream's module (favicons fetched, vendor words in
 * model names), or a substitute is missing a name upstream now exports.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const webRoot = NodePath.join(repoRoot, "apps/web");
const fromRepo = (file: string) => NodePath.join(repoRoot, file);

interface Case {
  readonly specifier: string;
  readonly upstream: object;
  readonly substitute: object;
  /** Upstream files that must keep importing these names from `specifier`. */
  readonly importers: Readonly<Record<string, ReadonlyArray<string>>>;
}

const CASES: Readonly<Record<string, Case>> = {
  "packages/shared/src/favicon.ts": {
    specifier: "@t3tools/shared/favicon",
    upstream: UpstreamFavicon,
    substitute: OurFavicon satisfies typeof UpstreamFavicon,
    importers: {
      "apps/web/src/components/ChatMarkdown.tsx": ["faviconUrlForOrigin"],
      "apps/web/src/components/chat/MessagesTimeline.tsx": ["toolActivityFaviconUrl"],
      "apps/web/src/lib/favicon.ts": ["faviconUrlForOrigin"],
    },
  },
  "packages/client-runtime/src/providerUpdateRequiredModels.ts": {
    specifier: "@t3tools/client-runtime/providerUpdateRequiredModels",
    upstream: UpstreamUpdateNotice,
    substitute: OurUpdateNotice satisfies typeof UpstreamUpdateNotice,
    importers: {
      "apps/web/src/components/chat/ModelPickerContent.tsx": ["formatProviderUpdateRequiredNotice"],
    },
  },
  "packages/client-runtime/src/state/subagentDisplay.ts": {
    specifier: "@t3tools/client-runtime/state/subagent-display",
    upstream: UpstreamSubagentDisplay,
    substitute: OurSubagentDisplay satisfies typeof UpstreamSubagentDisplay,
    importers: {
      "apps/web/src/components/chat/SubagentTooltipContent.tsx": ["resolveSubagentMetadata"],
    },
  },
};

const substitutePath = (upstream: string) => NodePath.join(here, SUBSTITUTES[upstream]!);

/** Every (specifier, upstream importer) pair, and the file it must resolve to. */
const expectations = Object.entries(CASES).flatMap(([upstream, { specifier, importers }]) =>
  Object.keys(importers).map((importer) => ({
    key: `${specifier} from ${importer}`,
    specifier,
    importer: fromRepo(importer),
    upstream: fromRepo(upstream),
    substitute: substitutePath(upstream),
  })),
);

async function configFor(command: ConfigEnv["command"]): Promise<UserConfig> {
  const env: ConfigEnv = { command, mode: command === "build" ? "production" : "development" };
  return typeof webConfig === "function" ? await webConfig(env) : await webConfig;
}

function importedNames(source: string, specifier: string): string[] {
  const from = specifier.replaceAll(/[/.]/g, (char) => `\\${char}`);
  const pattern = new RegExp(`(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*["']${from}["']`, "g");
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1]!.split(",").map((name) => name.trim().replace(/^type\s+/, "")),
  );
}

describe("Stemcells' substitutes for upstream modules", () => {
  it("has a case here for every substitute, and every file exists", () => {
    expect(Object.keys(CASES).toSorted()).toEqual(Object.keys(SUBSTITUTES).toSorted());
    for (const upstream of Object.keys(SUBSTITUTES)) {
      expect(NodeFS.existsSync(fromRepo(upstream)), upstream).toBe(true);
      expect(NodeFS.existsSync(substitutePath(upstream)), SUBSTITUTES[upstream]).toBe(true);
    }
  });

  it("each substitute exports every name its upstream module does", () => {
    for (const [upstream, { upstream: theirs, substitute: ours }] of Object.entries(CASES)) {
      expect(Object.keys(ours).toSorted(), upstream).toEqual(Object.keys(theirs).toSorted());
    }
  });

  it("upstream's views still import what we replace from the substituted module", () => {
    // A view that took the name from somewhere else would bypass the substitute.
    for (const { specifier, importers } of Object.values(CASES)) {
      for (const [importer, names] of Object.entries(importers)) {
        const source = NodeFS.readFileSync(fromRepo(importer), "utf8");
        expect(importedNames(source, specifier), importer).toEqual(
          expect.arrayContaining([...names]),
        );
      }
    }
  });

  it("the web app's config builds every target with the substitutes", async () => {
    // Dev and the production build use the config's plugins; both test
    // projects (unit and browser) inherit them through `extends: true`.
    for (const command of ["serve", "build"] as const) {
      const config = await configFor(command);
      const names = (config.plugins ?? []).flat().map((plugin) => (plugin as Plugin)?.name);
      expect(names, command).toContain(substituteUpstreamModules().name);
      const projects = (config.test?.projects ?? []) as ReadonlyArray<{ extends?: unknown }>;
      expect(projects.length, command).toBeGreaterThan(0);
      for (const project of projects) expect(project.extends, command).toBe(true);
    }
  });

  it("vitest: this test run hands upstream's code the substitute", () => {
    // `lib/favicon.ts` is upstream's: it re-exports `@t3tools/shared/favicon`.
    expect(
      UpstreamFaviconReexport.faviconUrlForOrigin,
      "run the web's tests with apps/web's config: pnpm --filter @t3tools/web exec vp test run …",
    ).toBe(OurFavicon.faviconUrlForOrigin);
  });

  it("dev: the dev server resolves upstream's imports to the substitutes", async () => {
    const config = await configFor("serve");
    const server = await createServer({
      ...config,
      configFile: false,
      root: webRoot,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, ws: false, warmup: {} },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const container = server.environments.client.pluginContainer;
      for (const { key, specifier, importer, upstream, substitute } of expectations) {
        expect((await container.resolveId(specifier, importer))?.id, key).toBe(substitute);
        // Our own folder gets upstream's module, so a substitute can wrap it.
        const ours = NodePath.join(here, "plugin.ts");
        expect((await container.resolveId(specifier, ours))?.id, key).toBe(upstream);
      }
      const served = await server.transformRequest("/src/lib/favicon.ts");
      expect(served?.code).toContain("/src/stemcells/upstream/substitutes/favicon.ts");
    } finally {
      await server.close();
    }
  }, 60_000);

  it("build: the production build (what the desktop app ships) bundles the substitutes", async () => {
    // The server's build copies the web's build into the bundle the desktop
    // app serves its window from.
    const serverBuild = NodeFS.readFileSync(fromRepo("apps/server/scripts/cli.ts"), "utf8");
    expect(serverBuild).toContain('"apps/web/dist"');

    const resolved = new Map<string, string | undefined>();
    const probe: Plugin = {
      name: "stemcells:substitutes-probe",
      async buildStart() {
        for (const { key, specifier, importer } of expectations) {
          resolved.set(key, (await this.resolve(specifier, importer))?.id);
        }
      },
    };
    const config = await configFor("build");
    const output = await build({
      ...config,
      configFile: false,
      root: webRoot,
      logLevel: "silent",
      plugins: [...(config.plugins ?? []), probe],
      build: {
        write: false,
        minify: false,
        sourcemap: false,
        manifest: false,
        emptyOutDir: false,
        rollupOptions: {
          input: NodePath.join(webRoot, "src/lib/favicon.ts"),
          preserveEntrySignatures: "strict",
        },
      },
    });
    for (const { key, substitute } of expectations) expect(resolved.get(key), key).toBe(substitute);

    const outputs = (Array.isArray(output) ? output : [output]).flatMap((result) =>
      "output" in result ? result.output : [],
    );
    const moduleIds = outputs.flatMap((chunk) => ("moduleIds" in chunk ? chunk.moduleIds : []));
    // The substitute only re-exports, so the bundle holds what it re-exports.
    expect(moduleIds).toContain(NodePath.join(here, "../favicon.ts"));
  }, 120_000);

  it("server: imports none of the substituted modules, so needs no substitute", () => {
    // The server runs from source in dev (`node src/bin.ts`), with no bundler
    // to substitute through. A server import of one of these would get
    // upstream's module: give the server a seam of its own instead.
    const specifiers = Object.values(CASES).map(({ specifier }) => specifier);
    const serverSource = NodePath.join(repoRoot, "apps/server/src");
    const offenders = NodeFS.readdirSync(serverSource, { recursive: true })
      .map(String)
      .filter((file) => /\.tsx?$/.test(file) && !file.startsWith(`stemcells${NodePath.sep}`))
      .filter((file) => {
        const source = NodeFS.readFileSync(NodePath.join(serverSource, file), "utf8");
        return specifiers.some((specifier) => source.includes(`"${specifier}"`));
      });
    expect(offenders).toEqual([]);
  });
});
