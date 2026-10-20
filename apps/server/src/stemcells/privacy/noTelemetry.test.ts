// @effect-diagnostics nodeBuiltinImport:off - reads the repository's tracked source on disk.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Stemcells sends no telemetry or usage data, to T3 or anyone else. Every
 * build is made from these folders, so none of them may carry T3's analytics
 * endpoint, a PostHog project key or a PostHog client. If this fails after a
 * sync, upstream added a way to report on the person: turn it off before
 * merging (`stemcells/seams.md`, No telemetry).
 */

const repoRoot = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../../../../..",
);
const BUILT_FROM = [
  "apps/server",
  "apps/web",
  "apps/desktop",
  "apps/mobile",
  "packages",
  "scripts",
];

function trackedFiles(): string[] {
  return NodeChildProcess.execFileSync("git", ["ls-files", "--", ...BUILT_FROM], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter((file) => file !== "");
}

const isShippedCode = (file: string) =>
  /\.(?:[cm]?[jt]sx?)$/.test(file) && !/(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(file);

function filesMatching(files: string[], pattern: RegExp): string[] {
  return files.filter((file) =>
    pattern.test(NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8")),
  );
}

describe("no Stemcells build reports on the person", () => {
  const files = trackedFiles();
  const code = files.filter(isShippedCode);

  it("names no T3 analytics endpoint and carries no PostHog key", () => {
    expect(code.length).toBeGreaterThan(1000);
    expect(filesMatching(code, /ingest\.t3\.codes/)).toEqual([]);
    expect(filesMatching(code, /\bphc_[A-Za-z0-9]{20,}/)).toEqual([]);
  });

  it("depends on no PostHog client", () => {
    const manifests = files.filter((file) => file.endsWith("package.json"));
    expect(manifests.length).toBeGreaterThan(10);
    expect(filesMatching(manifests, /"posthog[\w-]*"\s*:/)).toEqual([]);
    expect(
      filesMatching(code, /\bfrom\s+["']posthog|\b(?:import|require)\(\s*["']posthog/),
    ).toEqual([]);
  });

  it("keeps no analytics id for a browser or app, and claims no usage data is collected", () => {
    const ours = "apps/web/src/stemcells/privacy/";
    const web = code.filter((file) => file.startsWith("apps/web/src/") && !file.startsWith(ours));
    expect(filesMatching(web, /t3code:analytics-device-id/)).toEqual([]);
    const words = code.filter((file) => /^apps\/(?:web|desktop)\/src\//.test(file));
    expect(filesMatching(words, /anonymous usage data/i)).toEqual([]);
  });
});

/**
 * Nor does it tell anyone what the person reads or which build they run: a
 * link's or a page's icon is never fetched (a favicon service learns every
 * hostname in a chat), and Update Everything never asks npm about T3's
 * release, since Stemcells never offers T3's build.
 */
describe("no Stemcells build tells a third party what the person reads", () => {
  const code = trackedFiles().filter(isShippedCode);
  const read = (file: string) => NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8");
  const webAdapter = "apps/web/src/stemcells/upstream/favicon.ts";
  const mobileAdapter = "apps/mobile/src/stemcells/upstream/favicon.ts";

  it("fetches favicons only through Stemcells' adapters, the same on the web and the phone", () => {
    // The web's build hands every import of upstream's favicons the adapter
    // (`substitutes/plugin.ts`; `substitutes.contract.test.ts` proves it for
    // each build). The phone and the desktop substitute nothing, so there
    // only the adapter may import them.
    const substitutes = "apps/web/src/stemcells/upstream/substitutes/";
    expect(read(`${substitutes}plugin.ts`)).toContain(
      '"packages/shared/src/favicon.ts": "favicon.ts"',
    );
    expect(read(`${substitutes}favicon.ts`)).toContain('from "../favicon";');
    const callers = filesMatching(
      code.filter((file) => /^apps\/(?:mobile|desktop)\/src\//.test(file)),
      /["']@t3tools\/shared\/favicon["']/,
    );
    expect(callers).toEqual([mobileAdapter]);
    expect(read(mobileAdapter)).toBe(read(webAdapter));
  });

  it("asks npm about no T3 release", () => {
    const web = code.filter(
      (file) => file.startsWith("apps/web/src/") && file !== "apps/web/src/state/npmRelease.ts",
    );
    expect(filesMatching(web, /\b(?:useNpmReleasePublished|npmReleasePublishedAtom)\(/)).toEqual(
      [],
    );
  });
});
