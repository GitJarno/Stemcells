// @effect-diagnostics nodeBuiltinImport:off - reads our source files on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

/**
 * Only an app's `stemcells/upstream/` adapter imports upstream's code. The
 * rest of that app's folder goes through it, so when upstream changes shape
 * the type checker fails in one place per app (stemcells/docs/fork.md,
 * rule 2). Each app's `boundary.test.ts` runs this over its own folder.
 */

/** A workspace package of upstream's, by the start of its name. */
const UPSTREAM_PACKAGES = ["@t3tools/", "effect-acp", "effect-codex-app-server"];

const isIn = (dir: string, path: string) => path === dir || path.startsWith(dir + NodePath.sep);

// `from "…"`, a bare or dynamic import, a `require`, and a test's module mock.
const IMPORT_PATTERN =
  /\b(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|\b(?:import|require|mock|doMock|unmock|importActual|importOriginal)\s*\(\s*["']([^"']+)["']|\bimport\s+["']([^"']+)["']/g;

/** Every module `source` names: imports, re-exports, requires and mocks. */
export function importSpecifiers(source: string): string[] {
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2] ?? match[3]!);
}

export interface Boundary {
  /** Why `specifier`, imported by `file`, reaches into upstream; null when it doesn't. */
  readonly upstreamReach: (file: string, specifier: string) => string | null;
  /** Each import in our folder that reaches upstream outside the adapter, one line each. */
  readonly violations: () => string[];
}

/** The boundary of the app whose folder of ours is `ourRoot` (`apps/<app>/src/stemcells`). */
export function boundaryOf(ourRoot: string): Boundary {
  const adapterRoot = NodePath.join(ourRoot, "upstream");
  const repoRoot = NodePath.resolve(ourRoot, "../../../..");
  const appsRoot = NodePath.join(repoRoot, "apps");
  /** Our folder at the repository's root (the brand, the docs), ours too. */
  const ourRepoRoot = NodePath.join(repoRoot, "stemcells");

  /** Another app's folder of ours holding `path`; null when no app's does. */
  const otherAppsRoot = (path: string): string | null => {
    if (!isIn(appsRoot, path)) return null;
    const [app, src, ours] = NodePath.relative(appsRoot, path).split(NodePath.sep);
    return app !== undefined && src === "src" && ours === "stemcells"
      ? NodePath.join(appsRoot, app, "src", "stemcells")
      : null;
  };

  const upstreamReach = (file: string, specifier: string): string | null => {
    if (isIn(adapterRoot, file)) return null;
    if (specifier.startsWith("~/")) return "upstream app code (~/)";
    if (
      UPSTREAM_PACKAGES.some((name) =>
        name.endsWith("/")
          ? specifier.startsWith(name)
          : specifier === name || specifier.startsWith(`${name}/`),
      )
    ) {
      return "an upstream package";
    }
    if (!specifier.startsWith(".")) return null;
    const resolved = NodePath.resolve(NodePath.dirname(file), specifier);
    if (isIn(ourRoot, resolved) || isIn(ourRepoRoot, resolved)) return null;
    // Another app's code of ours is ours (the phone's kit.ts files draw with
    // the web's). Its adapter is that app's way into upstream, not this one's.
    const other = otherAppsRoot(resolved);
    if (other === null) return "upstream app code (relative path)";
    return isIn(NodePath.join(other, "upstream"), resolved) ? "another app's adapter" : null;
  };

  const violations = (): string[] => {
    const files = NodeFS.readdirSync(ourRoot, { recursive: true })
      .map(String)
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
      .map((file) => NodePath.join(ourRoot, file));
    if (!files.some((file) => isIn(adapterRoot, file))) {
      throw new Error(`No upstream adapter in ${ourRoot}: is this an app's folder of ours?`);
    }
    return files.flatMap((file) =>
      importSpecifiers(NodeFS.readFileSync(file, "utf8")).flatMap((specifier) => {
        const reach = upstreamReach(file, specifier);
        return reach
          ? [`${NodePath.relative(ourRoot, file)} imports "${specifier}": ${reach}`]
          : [];
      }),
    );
  };

  return { upstreamReach, violations };
}
