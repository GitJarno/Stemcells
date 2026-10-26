// @effect-diagnostics nodeBuiltinImport:off - reads the repository's tracked source on disk.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

/**
 * Stemcells sends no telemetry or usage data. No folder a build is made from may carry T3's
 * analytics endpoint, a PostHog project key or a PostHog client. If this fails after a sync,
 * upstream added a way to report on the person: turn it off before merging
 * (`stemcells/seams.md`, No telemetry).
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
    // Upstream's privacy row keeps its words in its own panel, drawn hidden
    // and never searched (the web's settingsSearch substitute,
    // privacyRow.browser.test.tsx): a person never reads them.
    const privacyRow = "apps/web/src/components/settings/SettingsPanels.tsx";
    expect(filesMatching(words, /anonymous usage data/i)).toEqual([privacyRow]);
    const panels = NodeFS.readFileSync(NodePath.join(repoRoot, privacyRow), "utf8");
    const rows = panels
      .split(/(?=<SettingsRow\b)/)
      .filter((row) => /anonymous usage data/i.test(row));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatch(/^<SettingsRow\s*\{\.\.\.searchableSetting\("privacy-policy"\)\}/);
  });
});

/**
 * Every host the shipped code names, and every file naming an install, anonymous or analytics
 * id, an update feed or a crash reporter, is in `stemcells/outbound.txt` with why it may stay;
 * no dependency reports on the person. A new one fails until someone reads it: turn off what
 * reports on the person, list the rest (`stemcells/docs/upstream-sync.md`, Outbound).
 */
describe("nothing leaves the machine that stemcells/outbound.txt doesn't name", () => {
  const SHIPPED = [
    "apps/server/src",
    "apps/web/src",
    "apps/desktop/src",
    "apps/mobile/src",
    "packages",
    "apps/mobile/app.config.ts",
  ];
  const NOT_SHIPPED =
    /(?:\.(?:test|spec|testkit)\.[cm]?[jt]sx?$|\/(?:test|tests|__tests__|testing|fixtures?|testUtils)\/|\/scripts\/)/;
  // Loopback, an IP address and the names reserved for examples reach no one.
  const NEVER_CONTACTED =
    /(?:^|\.)(?:localhost|example|invalid|test|local)$|(?:^|\.)example\.(?:com|net|org)$|^(?:\d+\.){3}\d+$/;
  const ID =
    "anonymousId|anonymous_id|installationId|installation_id|installId|install_id|distinctId|distinct_id|machineId|telemetryId|analytics-device-id|crashReporter|setFeedURL|autoUpdater";
  const REPORTS_ON_THE_PERSON =
    /^(?:posthog.*|@posthog\/.*|@sentry\/.*|sentry-.*|@datadog\/.*|dd-trace|mixpanel.*|@amplitude\/.*|amplitude-js|@segment\/.*|analytics-node|@bugsnag\/.*|bugsnag.*|rollbar|logrocket.*|@vercel\/analytics|@vercel\/speed-insights|newrelic|@newrelic\/.*|@honeycombio\/.*|@opentelemetry\/.*|@effect\/opentelemetry|@grafana\/faro.*|@highlight-run\/.*|@axiomhq\/.*|applicationinsights|@microsoft\/applicationinsights.*|firebase|@react-native-firebase\/.*|expo-insights)$/;

  /** Each match of `pattern` in the shipped code, as [file, match]. */
  function grep(pattern: string, flags: string[]): Array<[string, string]> {
    const run = NodeChildProcess.spawnSync(
      "git",
      ["grep", "-I", "-o", ...flags, "-E", pattern, "--", ...SHIPPED],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
    );
    if (run.status !== 0 && run.status !== 1) throw new Error(run.stderr);
    return run.stdout
      .split("\n")
      .filter((line) => line !== "")
      .map((line): [string, string] => {
        const at = line.indexOf(":");
        return [line.slice(0, at), line.slice(at + 1)];
      })
      .filter(([file]) => isShippedCode(file) && !NOT_SHIPPED.test(file));
  }

  const listed = {
    hosts: new Set<string>(),
    idFiles: [] as string[],
    forbidden: [] as string[],
    cutFiles: [] as string[],
  };
  for (const line of NodeFS.readFileSync(
    NodePath.join(repoRoot, "stemcells/outbound.txt"),
    "utf8",
  ).split("\n")) {
    const [kind, name, ...why] = line.trim().split(/\s+/);
    if (!kind || kind.startsWith("#")) continue;
    if (!name || why.length === 0) throw new Error(`stemcells/outbound.txt: "${line}" says no why`);
    if (kind === "host") listed.hosts.add(name.toLowerCase());
    else if (kind === "id") listed.idFiles.push(name);
    else if (kind === "forbid") listed.forbidden.push(name.toLowerCase());
    else if (kind === "cut") listed.cutFiles.push(name);
    // `live` lines are the running app's, read by stemcells/lab/outbound-live.mjs.
    else if (kind !== "live") throw new Error(`stemcells/outbound.txt: unknown kind "${kind}"`);
  }

  // A forbidden address may stay named only in a file whose fetch Stemcells
  // cut, each listed with how: a sync that adds a fetch from one fails here.
  it("names a forbidden address only where its fetch is cut, and lists no cut the code dropped", () => {
    expect(listed.forbidden.length).toBeGreaterThan(0);
    const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const naming = [
      ...new Set(
        listed.forbidden.flatMap((prefix) => grep(escape(prefix), ["-i"]).map(([file]) => file)),
      ),
    ];
    expect(naming.filter((file) => !listed.cutFiles.includes(file))).toEqual([]);
    expect(listed.cutFiles.filter((file) => !naming.includes(file))).toEqual([]);
  });

  it("names no host the list lacks, and the list names no host the code dropped", () => {
    const named = new Map<string, string[]>();
    for (const [file, match] of grep("(https?|wss?)://[a-z0-9-]+(\\.[a-z0-9-]+)+", ["-i"])) {
      const host = match.replace(/^[a-z]+:\/\//i, "").toLowerCase();
      if (NEVER_CONTACTED.test(host)) continue;
      named.set(host, [...new Set([...(named.get(host) ?? []), file])]);
    }
    expect(named.size).toBeGreaterThan(20);
    const unlisted = [...named]
      .filter(([host]) => !listed.hosts.has(host))
      .map(([host, files]) => `${host} (${files.join(", ")})`);
    expect(unlisted).toEqual([]);
    expect([...listed.hosts].filter((host) => !named.has(host))).toEqual([]);
  });

  it("names an install, anonymous or analytics id, a feed or a crash reporter only where listed", () => {
    // An entry ending in `/` covers its folder.
    const covers = (entry: string, file: string) =>
      entry.endsWith("/") ? file.startsWith(entry) : file === entry;
    const files = [...new Set(grep(ID, ["-w"]).map(([file]) => file))];
    expect(files.filter((file) => !listed.idFiles.some((entry) => covers(entry, file)))).toEqual(
      [],
    );
    expect(listed.idFiles.filter((entry) => !files.some((file) => covers(entry, file)))).toEqual(
      [],
    );
  });

  it("depends on no analytics, crash-reporting or tracing package", () => {
    const manifests = NodeChildProcess.execFileSync(
      "git",
      ["ls-files", "--", "package.json", "**/package.json", ":!.repos/"],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .split("\n")
      .filter((file) => file !== "");
    expect(manifests.length).toBeGreaterThan(10);
    const found = manifests.flatMap((file) => {
      const manifest = JSON.parse(NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8"));
      return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
        .flatMap((field) => Object.keys(manifest[field] ?? {}))
        .filter((name) => REPORTS_ON_THE_PERSON.test(name))
        .map((name) => `${file}: ${name}`);
    });
    expect(found).toEqual([]);
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
    // The web's and the phone's builds hand every import of upstream's
    // favicons the adapter (each app's `substitutes.contract.test.ts` proves
    // it for each build). The desktop substitutes nothing, so none of its
    // code may import them.
    const web = "apps/web/src/stemcells/upstream/substitutes/";
    const phone = "apps/mobile/src/stemcells/upstream/substitutes/";
    expect(read(`${web}plugin.ts`)).toContain('"packages/shared/src/favicon.ts": "favicon.ts"');
    expect(read(`${phone}substitutes.cjs`)).toContain(
      '"packages/shared/src/favicon.ts": "favicon.ts"',
    );
    for (const folder of [web, phone]) {
      expect(read(`${folder}favicon.ts`)).toContain('from "../favicon";');
    }
    const callers = filesMatching(
      code.filter((file) => file.startsWith("apps/desktop/src/")),
      /["']@t3tools\/shared\/favicon["']/,
    );
    expect(callers).toEqual([]);
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
