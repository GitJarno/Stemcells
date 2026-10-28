// @effect-diagnostics nodeBuiltinImport:off - reads upstream's files and loads the build configs.
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import * as UpstreamSubagentDisplay from "@t3tools/client-runtime/state/subagent-display";
import * as UpstreamT3ToolSummary from "@t3tools/client-runtime/t3ToolSummary";
import * as UpstreamFavicon from "@t3tools/shared/favicon";
import * as UpstreamT3McpTools from "@t3tools/shared/t3McpToolPresentation";
import { createServer, type Plugin, type UserConfig } from "vite-plus";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";

import phoneTestConfig from "../../../../vite.config";
import * as OurFavicon from "./favicon";
import * as OurSubagentDisplay from "./subagentDisplay";
import { PACKAGES, SUBSTITUTES } from "./substitutes.cjs";
import * as OurT3McpTools from "./t3McpToolPresentation";
import * as OurT3ToolSummary from "./t3ToolSummary";

/**
 * Contract: the phone's builds (Metro, for the app; Vite, for its tests) hand
 * upstream's views our substitute for each module in `SUBSTITUTES`, and each
 * substitute still exports what its upstream module does. If this fails after
 * a sync, a phone view fetches favicons again or shows T3's mark.
 */

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const repoRoot = NodePath.resolve(here, "../../../../../..");
const phoneRoot = NodePath.join(repoRoot, "apps/mobile");
const fromRepo = (file: string) => NodePath.join(repoRoot, file);
const substitutes: Readonly<Record<string, string>> = SUBSTITUTES;

interface Case {
  /** The names upstream's module exports, and the names the substitute does. */
  readonly exports: readonly [upstream: ReadonlyArray<string>, substitute: ReadonlyArray<string>];
  /** Upstream files that import the module: by which specifier, and which names. */
  readonly importers: Readonly<Record<string, readonly [string, ReadonlyArray<string>]>>;
}

/**
 * A view's exported names, from its source: Node can't load React Native, so
 * the views' cases read their `export`s, and their types are checked below.
 */
function exportsOf(file: string): string[] {
  const source = NodeFS.readFileSync(file, "utf8");
  const declared = [...source.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)];
  const listed = [...source.matchAll(/^export \{([^}]*)\}/gm)].flatMap((match) =>
    match[1]!.split(",").map((name) => name.trim()),
  );
  // A substitute that wraps one export passes the rest on from upstream's module.
  const passed = [...source.matchAll(/^export \* from "(\.[^"]+)";/gm)].flatMap((match) =>
    exportsOf(
      [".tsx", ".ts"]
        .map((extension) => NodePath.resolve(NodePath.dirname(file), match[1]!) + extension)
        .find((candidate) => NodeFS.existsSync(candidate))!,
    ),
  );
  return [...new Set([...declared.map((match) => match[1]!), ...listed, ...passed])].filter(
    (name) => name !== "",
  );
}

const view = (upstream: string, ours: string) =>
  [exportsOf(fromRepo(upstream)), exportsOf(NodePath.join(here, ours))] as const;

const CASES: Readonly<Record<string, Case>> = {
  "packages/shared/src/favicon.ts": {
    exports: [
      Object.keys(UpstreamFavicon),
      Object.keys(OurFavicon satisfies typeof UpstreamFavicon),
    ],
    importers: {
      "apps/mobile/src/features/threads/thread-work-log.tsx": [
        "@t3tools/shared/favicon",
        ["toolActivityFaviconUrl"],
      ],
    },
  },
  "apps/mobile/src/components/T3Wordmark.tsx": {
    exports: view("apps/mobile/src/components/T3Wordmark.tsx", "T3Wordmark.tsx"),
    importers: {
      "apps/mobile/src/features/threads/thread-work-log.tsx": [
        "../../components/T3Wordmark",
        ["T3Wordmark"],
      ],
      "apps/mobile/src/components/CompactBrandTitle.tsx": ["./T3Wordmark", ["T3Wordmark"]],
    },
  },
  "apps/mobile/src/components/CompactBrandTitle.tsx": {
    exports: view("apps/mobile/src/components/CompactBrandTitle.tsx", "CompactBrandTitle.tsx"),
    importers: {
      "apps/mobile/src/Stack.tsx": [
        "./components/CompactBrandTitle",
        ["getCompactBrandHeaderOptions"],
      ],
      "apps/mobile/src/features/home/WorkspaceConnectionTitle.tsx": [
        "../../components/CompactBrandTitle",
        ["brandTitleOffset", "CompactBrandTitle", "getCompactBrandHeaderOptions"],
      ],
      "apps/mobile/src/features/workspace/WorkspaceRootScreen.tsx": [
        "../../components/CompactBrandTitle",
        ["CompactBrandTitle"],
      ],
      "apps/mobile/src/features/workspace/WorkspaceListToolbarRow.tsx": [
        "../../components/CompactBrandTitle",
        ["CompactBrandTitle"],
      ],
      "apps/mobile/src/features/threads/ThreadNavigationSidebar.tsx": [
        "../../components/CompactBrandTitle",
        ["CompactBrandTitle"],
      ],
      "apps/mobile/src/features/threads/sidebar-navigation-shell.tsx": [
        "../../components/CompactBrandTitle",
        ["getCompactBrandHeaderOptions"],
      ],
    },
  },
  "apps/mobile/src/components/BrandMark.tsx": {
    exports: view("apps/mobile/src/components/BrandMark.tsx", "BrandMark.tsx"),
    importers: {
      "apps/mobile/src/components/LoadingScreen.tsx": ["./BrandMark", ["BrandMark"]],
    },
  },
  "apps/mobile/src/components/brandAssets.ts": {
    exports: view("apps/mobile/src/components/brandAssets.ts", "brandAssets.ts"),
    importers: {
      "apps/mobile/src/components/BrandMark.tsx": ["./brandAssets", ["T3_CODE_BRAND_MARK_SOURCE"]],
    },
  },
  "packages/shared/src/t3McpToolPresentation.ts": {
    exports: [
      Object.keys(UpstreamT3McpTools),
      Object.keys(OurT3McpTools satisfies typeof UpstreamT3McpTools),
    ],
    importers: {
      "apps/mobile/src/lib/threadActivity.ts": [
        "@t3tools/shared/t3McpToolPresentation",
        ["resolveT3McpToolDefinition", "resolveT3McpToolPresentation"],
      ],
      "packages/client-runtime/src/work-log/presentation.ts": [
        "@t3tools/shared/t3McpToolPresentation",
        ["resolveT3McpToolDefinition"],
      ],
    },
  },
  "packages/client-runtime/src/t3ToolSummary.ts": {
    exports: [
      Object.keys(UpstreamT3ToolSummary),
      Object.keys(OurT3ToolSummary satisfies typeof UpstreamT3ToolSummary),
    ],
    importers: {
      "packages/client-runtime/src/work-log/presentation.ts": [
        "@t3tools/client-runtime/t3ToolSummary",
        ["summarizeT3ToolCalls"],
      ],
    },
  },
  "apps/mobile/src/features/threads/ThreadComposer.tsx": {
    exports: view("apps/mobile/src/features/threads/ThreadComposer.tsx", "ThreadComposer.tsx"),
    importers: {
      "apps/mobile/src/features/threads/ThreadDetailScreen.tsx": [
        "./ThreadComposer",
        ["ThreadComposer"],
      ],
    },
  },
  "apps/mobile/src/features/threads/ThreadHeader.tsx": {
    exports: view("apps/mobile/src/features/threads/ThreadHeader.tsx", "ThreadHeader.tsx"),
    importers: {
      "apps/mobile/src/features/threads/ThreadRouteScreen.tsx": [
        "./ThreadHeader",
        ["ThreadHeader"],
      ],
      "apps/mobile/src/features/threads/DraftThreadHeader.tsx": [
        "./ThreadHeader",
        ["ThreadHeader"],
      ],
    },
  },
  "apps/mobile/src/features/threads/thread-header-appearance.ts": {
    exports: view(
      "apps/mobile/src/features/threads/thread-header-appearance.ts",
      "thread-header-appearance.ts",
    ),
    importers: {
      "apps/mobile/src/features/threads/useThreadHeaderOptions.tsx": [
        "./thread-header-appearance",
        ["threadHeaderAppearance"],
      ],
      "apps/mobile/src/features/threads/NewTaskDraftScreen.tsx": [
        "./thread-header-appearance",
        ["threadHeaderAppearance"],
      ],
    },
  },
  "apps/mobile/src/native/NativeScrollViewMarker.tsx": {
    exports: view(
      "apps/mobile/src/native/NativeScrollViewMarker.tsx",
      "NativeScrollViewMarker.tsx",
    ),
    importers: {
      "apps/mobile/src/features/home/HomeScreen.tsx": [
        "../../native/NativeScrollViewMarker",
        ["NativeScrollViewMarker"],
      ],
    },
  },
  "apps/mobile/src/features/home/HomeScreen.tsx": {
    exports: view("apps/mobile/src/features/home/HomeScreen.tsx", "HomeScreen.tsx"),
    importers: {
      "apps/mobile/src/features/home/HomeRouteScreen.tsx": ["./HomeScreen", ["HomeScreen"]],
    },
  },
  "apps/mobile/src/features/home/ThreadListFilters.tsx": {
    exports: view("apps/mobile/src/features/home/ThreadListFilters.tsx", "ThreadListFilters.tsx"),
    importers: {
      "apps/mobile/src/features/home/HomeScreen.tsx": [
        "./ThreadListFilters",
        ["ThreadListFilters"],
      ],
    },
  },
  "apps/mobile/src/features/threads/thread-list-v2-row-appearance.ts": {
    exports: view(
      "apps/mobile/src/features/threads/thread-list-v2-row-appearance.ts",
      "thread-list-v2-row-appearance.ts",
    ),
    importers: {
      "apps/mobile/src/features/threads/thread-list-v2-items.tsx": [
        "./thread-list-v2-row-appearance",
        [
          "THREAD_LIST_V2_ROW_CONTENT_CLASS_NAME",
          "THREAD_LIST_V2_ROW_DIVIDERS",
          "getThreadListV2RowAppearance",
        ],
      ],
    },
  },
  "apps/mobile/src/features/threads/use-thread-list-v2-shelf-preferences.ts": {
    exports: view(
      "apps/mobile/src/features/threads/use-thread-list-v2-shelf-preferences.ts",
      "use-thread-list-v2-shelf-preferences.ts",
    ),
    importers: {
      "apps/mobile/src/features/home/HomeScreen.tsx": [
        "../threads/use-thread-list-v2-shelf-preferences",
        ["useThreadListV2ShelfPreferences"],
      ],
    },
  },
  "apps/mobile/src/features/threads/ComposerAttachmentButton.tsx": {
    exports: view(
      "apps/mobile/src/features/threads/ComposerAttachmentButton.tsx",
      "ComposerAttachmentButton.tsx",
    ),
    importers: {
      "apps/mobile/src/features/threads/ThreadComposer.tsx": [
        "./ComposerAttachmentButton",
        ["ComposerAttachmentButton"],
      ],
      "apps/mobile/src/features/threads/QuestionAttachments.tsx": [
        "./ComposerAttachmentButton",
        ["ComposerAttachmentButton"],
      ],
    },
  },
  "packages/client-runtime/src/state/subagentDisplay.ts": {
    exports: [
      Object.keys(UpstreamSubagentDisplay),
      Object.keys(OurSubagentDisplay satisfies typeof UpstreamSubagentDisplay),
    ],
    importers: {
      "apps/mobile/src/lib/threadActivity.ts": [
        "@t3tools/client-runtime/state/subagent-display",
        ["formatSubagentDisplayTitle"],
      ],
    },
  },
};

/** Each package substituted by name: upstream's file that imports it, and what that file calls of it. */
const PACKAGE_CASES: Readonly<
  Record<string, { readonly importer: string; readonly calls: ReadonlyArray<string> }>
> = {
  "expo-image-picker": {
    importer: "apps/mobile/src/lib/composerImages.ts",
    calls: ["launchImageLibraryAsync"],
  },
  "expo-observe": {
    importer: "apps/mobile/src/features/observability/observe.ts",
    calls: ["configure", "dispatchEvents", "reportError"],
  },
};
const packages: Readonly<Record<string, string>> = PACKAGES;
const packageExpectations = Object.entries(PACKAGE_CASES).map(([name, { importer }]) => ({
  name,
  importer: fromRepo(importer),
  substitute: NodePath.join(here, packages[name]!),
}));
/** A package's own file, which must keep the package it imports. */
const insidePackage = NodePath.join(phoneRoot, "node_modules/expo/build/Expo.js");

const substitutePath = (upstream: string) => NodePath.join(here, substitutes[upstream]!);

/** How a file in our folder names the upstream module: a package as is, a file by its path. */
const fromOurs = (specifier: string, upstream: string) =>
  specifier.startsWith(".")
    ? `./${NodePath.relative(here, fromRepo(upstream)).replace(/\.tsx?$/, "")}`
    : specifier;

const expectations = Object.entries(CASES).flatMap(([upstream, { importers }]) =>
  Object.entries(importers).map(([importer, [specifier]]) => ({
    key: `${specifier} from ${importer}`,
    specifier,
    specifierFromOurs: fromOurs(specifier, upstream),
    importer: fromRepo(importer),
    upstream: fromRepo(upstream),
    substitute: substitutePath(upstream),
  })),
);

function importedNames(source: string, specifier: string): string[] {
  const from = specifier.replaceAll(/[/.]/g, (char) => `\\${char}`);
  const pattern = new RegExp(`(?:import|export)\\s*\\{([^}]*)\\}\\s*from\\s*["']${from}["']`, "g");
  return [...source.matchAll(pattern)].flatMap((match) =>
    // An import renamed locally (`a as b`) still imports `a`.
    match[1]!.split(",").map((name) =>
      name
        .trim()
        .replace(/^type\s+/, "")
        .replace(/\s+as\s+\w+$/, ""),
    ),
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

  it("has a case here for every package substitute, and every file exists", () => {
    expect(Object.keys(PACKAGE_CASES).toSorted()).toEqual(Object.keys(packages).toSorted());
    for (const { importer, substitute } of packageExpectations) {
      expect(NodeFS.existsSync(importer), importer).toBe(true);
      expect(NodeFS.existsSync(substitute), substitute).toBe(true);
    }
  });

  it("upstream still imports each substituted package and calls what we replace", () => {
    for (const [name, { importer, calls }] of Object.entries(PACKAGE_CASES)) {
      const source = NodeFS.readFileSync(fromRepo(importer), "utf8");
      expect(source, importer).toMatch(new RegExp(`(?:from |import\\()"${name}"`));
      for (const call of calls) expect(source, importer).toContain(`.${call}(`);
    }
  });

  it("each substitute exports every name its upstream module does", () => {
    for (const [
      upstream,
      {
        exports: [theirs, ours],
      },
    ] of Object.entries(CASES)) {
      expect(theirs.length, upstream).toBeGreaterThan(0);
      expect(ours.toSorted(), upstream).toEqual(theirs.toSorted());
    }
  });

  it("the views' substitutes have their upstream modules' types", () => {
    // Checked by the phone's typecheck: the views can't load in Node.
    expectTypeOf<typeof import("./T3Wordmark")>().toEqualTypeOf<
      typeof import("../../../components/T3Wordmark")
    >();
    expectTypeOf<typeof import("./CompactBrandTitle")>().toEqualTypeOf<
      typeof import("../../../components/CompactBrandTitle")
    >();
    expectTypeOf<typeof import("./BrandMark")>().toEqualTypeOf<
      typeof import("../../../components/BrandMark")
    >();
    expectTypeOf<typeof import("./brandAssets")>().toEqualTypeOf<
      typeof import("../../../components/brandAssets")
    >();
    expectTypeOf<typeof import("./ThreadComposer")>().toEqualTypeOf<
      typeof import("../../../features/threads/ThreadComposer")
    >();
    expectTypeOf<typeof import("./ThreadHeader")>().toEqualTypeOf<
      typeof import("../../../features/threads/ThreadHeader")
    >();
    expectTypeOf<typeof import("./thread-header-appearance")>().toEqualTypeOf<
      typeof import("../../../features/threads/thread-header-appearance")
    >();
    expectTypeOf<typeof import("./NativeScrollViewMarker")>().toEqualTypeOf<
      typeof import("../../../native/NativeScrollViewMarker")
    >();
    expectTypeOf<typeof import("./HomeScreen")>().toEqualTypeOf<
      typeof import("../../../features/home/HomeScreen")
    >();
    expectTypeOf<typeof import("./ThreadListFilters")>().toEqualTypeOf<
      typeof import("../../../features/home/ThreadListFilters")
    >();
    // Its tokens are other strings and flags, of the same kinds.
    expectTypeOf<
      typeof import("./thread-list-v2-row-appearance").getThreadListV2RowAppearance
    >().toEqualTypeOf<
      typeof import("../../../features/threads/thread-list-v2-row-appearance").getThreadListV2RowAppearance
    >();
    expectTypeOf<typeof import("./use-thread-list-v2-shelf-preferences")>().toEqualTypeOf<
      typeof import("../../../features/threads/use-thread-list-v2-shelf-preferences")
    >();
    expectTypeOf<typeof import("./ComposerAttachmentButton")>().toEqualTypeOf<
      typeof import("../../../features/threads/ComposerAttachmentButton")
    >();
    expectTypeOf<typeof import("./expo-image-picker")>().toEqualTypeOf<
      typeof import("expo-image-picker")
    >();
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
    for (const { name, importer, substitute } of packageExpectations) {
      const thePackage = NodePath.join(phoneRoot, "node_modules", name, "index.js");
      const metroResolves: ResolveRequest = () => ({ type: "sourceFile", filePath: thePackage });
      const resolve = (origin: string) =>
        resolveRequest({ originModulePath: origin, resolveRequest: metroResolves }, name, "ios");
      expect(resolve(importer).filePath, name).toBe(substitute);
      expect(resolve(substitute).filePath, name).toBe(thePackage);
      expect(resolve(insidePackage).filePath, name).toBe(thePackage);
    }
  });

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
      for (const {
        key,
        specifier,
        specifierFromOurs,
        importer,
        upstream,
        substitute,
      } of expectations) {
        expect((await container.resolveId(specifier, importer))?.id, key).toBe(substitute);
        const ours = NodePath.join(here, "favicon.ts");
        expect((await container.resolveId(specifierFromOurs, ours))?.id, key).toBe(upstream);
      }
      for (const { name, importer, substitute } of packageExpectations) {
        expect((await container.resolveId(name, importer))?.id, name).toBe(substitute);
        const fromOurs = (await container.resolveId(name, substitute))?.id;
        expect(fromOurs, name).toContain(`${NodePath.sep}node_modules${NodePath.sep}`);
        const fromPackage = (await container.resolveId(name, insidePackage))?.id;
        expect(fromPackage, name).toContain(`${NodePath.sep}node_modules${NodePath.sep}`);
      }
    } finally {
      await server.close();
    }
  });
});
