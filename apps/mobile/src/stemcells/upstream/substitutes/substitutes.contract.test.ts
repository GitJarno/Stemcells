// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and loads the build configs.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as UpstreamFavicon from "@t3tools/shared/favicon";
import { createServer, type Plugin, type UserConfig } from "vite-plus";
import { describe, expect, it } from "vite-plus/test";

import phoneTestConfig from "../../../../vite.config";
import * as OurFavicon from "./favicon";
import { SUBSTITUTES } from "./substitutes.cjs";

/**
 * Contract: the phone's builds (Metro, for the app; Vite, for its tests) hand
 * upstream's views our substitute for each module in `SUBSTITUTES`, and each
 * substitute still exports what its upstream module does. If this fails after
 * a sync, a phone view fetches favicons again.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const phoneRoot = NodePath.join(repoRoot, "apps/mobile");
const fromRepo = (file: string) => NodePath.join(repoRoot, file);
const substitutes: Readonly<Record<string, string>> = SUBSTITUTES;

interface Case {
  readonly upstream: object;
  readonly substitute: object;
  /** Upstream files that import the module: by which specifier, and which names. */
  readonly importers: Readonly<Record<string, readonly [string, ReadonlyArray<string>]>>;
}

const CASES: Readonly<Record<string, Case>> = {
  "packages/shared/src/favicon.ts": {
    upstream: UpstreamFavicon,
    substitute: OurFavicon satisfies typeof UpstreamFavicon,
    importers: {
      "apps/mobile/src/features/threads/ThreadFeed.tsx": [
        "@t3tools/shared/favicon",
        ["faviconUrlForOrigin"],
      ],
      "apps/mobile/src/features/threads/thread-work-log.tsx": [
        "@t3tools/shared/favicon",
        ["toolActivityFaviconUrl"],
      ],
    },
  },
};

const substitutePath = (upstream: string) => NodePath.join(here, substitutes[upstream]!);

const expectations = Object.entries(CASES).flatMap(([upstream, { importers }]) =>
  Object.entries(importers).map(([importer, [specifier]]) => ({
    key: `${specifier} from ${importer}`,
    specifier,
    importer: fromRepo(importer),
    upstream: fromRepo(upstream),
    substitute: substitutePath(upstream),
  })),
);

function importedNames(source: string, specifier: string): string[] {
  const from = specifier.replaceAll(/[/.]/g, (char) => `\\${char}`);
  const pattern = new RegExp(`(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*["']${from}["']`, "g");
  return [...source.matchAll(pattern)].flatMap((match) =>
    match[1]!.split(",").map((name) => name.trim().replace(/^type\s+/, "")),
  );
}

type Resolution = { readonly type: string; readonly filePath?: string };
type ResolveRequest = (context: object, moduleName: string, platform: string | null) => Resolution;

describe("the phone's substitutes for upstream modules", () => {
  it("has a case here for every substitute, and every file exists", () => {
    expect(Object.keys(CASES).toSorted()).toEqual(Object.keys(substitutes).toSorted());
    for (const upstream of Object.keys(substitutes)) {
      expect(NodeFS.existsSync(fromRepo(upstream)), upstream).toBe(true);
      expect(NodeFS.existsSync(substitutePath(upstream)), substitutes[upstream]).toBe(true);
    }
  });

  it("each substitute exports every name its upstream module does", () => {
    for (const [upstream, { upstream: theirs, substitute: ours }] of Object.entries(CASES)) {
      expect(Object.keys(ours).toSorted(), upstream).toEqual(Object.keys(theirs).toSorted());
    }
  });

  it("upstream's views still import what we replace from the substituted module", () => {
    for (const { importers } of Object.values(CASES)) {
      for (const [importer, [specifier, names]] of Object.entries(importers)) {
        const source = NodeFS.readFileSync(fromRepo(importer), "utf8");
        expect(importedNames(source, specifier), importer).toEqual(
          expect.arrayContaining([...names]),
        );
      }
    }
  });

  it("the app: Metro's resolver hands upstream's views the substitutes", async () => {
    // The config Metro runs, uniwind's resolver and all. Metro's own resolver
    // (stubbed here) finds upstream's module; ours swaps it for the substitute.
    const require = NodeModule.createRequire(import.meta.url);
    const config = (await require(NodePath.join(phoneRoot, "metro.config.js"))) as {
      readonly resolver: { readonly resolveRequest: ResolveRequest };
    };
    const resolveRequest = config.resolver.resolveRequest;
    for (const { key, specifier, importer, upstream, substitute } of expectations) {
      const metroResolves: ResolveRequest = (_context, moduleName) =>
        moduleName === specifier ? { type: "sourceFile", filePath: upstream } : { type: "empty" };
      const resolve = (origin: string) =>
        resolveRequest(
          { originModulePath: origin, resolveRequest: metroResolves },
          specifier,
          "ios",
        );
      expect(resolve(importer).filePath, key).toBe(substitute);
      // Our own folder gets upstream's module, so a substitute can wrap it.
      expect(resolve(NodePath.join(here, "favicon.ts")).filePath, key).toBe(upstream);
    }
  }, 60_000);

  it("the tests: the phone's test config resolves upstream's imports to the substitutes", async () => {
    const config = phoneTestConfig as UserConfig;
    const names = (config.plugins ?? []).flat().map((plugin) => (plugin as Plugin)?.name);
    expect(names).toContain("stemcells:substitute-upstream-modules");
    const projects = (config.test?.projects ?? []) as ReadonlyArray<{ extends?: unknown }>;
    expect(projects.length).toBeGreaterThan(0);
    for (const project of projects) expect(project.extends).toBe(true);

    const server = await createServer({
      ...config,
      configFile: false,
      root: phoneRoot,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const container = server.environments.client.pluginContainer;
      for (const { key, specifier, importer, upstream, substitute } of expectations) {
        expect((await container.resolveId(specifier, importer))?.id, key).toBe(substitute);
        const ours = NodePath.join(here, "favicon.ts");
        expect((await container.resolveId(specifier, ours))?.id, key).toBe(upstream);
      }
    } finally {
      await server.close();
    }
  }, 60_000);
});
