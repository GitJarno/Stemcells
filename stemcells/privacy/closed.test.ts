// @effect-diagnostics nodeBuiltinImport:off - reads upstream's .env.example and the entry points on disk.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { describe, expect, it } from "vite-plus/test";

import { loadRepoEnv } from "../../scripts/lib/public-config.ts";
import { heldIdentifiers, t3Identifiers } from "./built.ts";
import { closeToT3, isRefused } from "./closed.ts";
import { isCloudSwitch } from "./switches.ts";

const repoRoot = NodePath.resolve(import.meta.dirname, "../..");
const read = (file: string) => NodeFS.readFileSync(NodePath.join(repoRoot, file), "utf8");

/**
 * Upstream's `.env.example` with every line switched on, the commented ones too: what
 * `cp .env.example .env` and a careless uncomment would give a build. It carries T3's real
 * public identifiers, so it is also what a build must never hold.
 */
const everythingOn = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(
      NodeUtil.parseEnv(read(".env.example").replace(/^#\s*(?=[A-Z0-9_]+=)/gm, "")),
    ).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );

describe("no environment switches on upstream's hosted services", () => {
  it("knows every switch upstream's .env.example offers", () => {
    const offered = Object.keys(everythingOn());
    expect(offered.filter(isCloudSwitch).length).toBeGreaterThanOrEqual(7);
    // The rest sign a macOS build or name where T3's hosted app lives; none reports.
    expect(offered.filter((name) => !isCloudSwitch(name)).toSorted()).toEqual([
      "T3CODE_APPLE_TEAM_ID",
      "T3CODE_HOSTED_APP_URL",
      "T3CODE_MACOS_PROVISIONING_PROFILE",
    ]);
  });

  it("hands a build none of them, from a copied .env or from the shell", () => {
    const folder = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "closed-"));
    try {
      NodeFS.writeFileSync(
        NodePath.join(folder, ".env"),
        Object.entries(everythingOn())
          .map(([name, value]) => `${name}=${value}`)
          .join("\n"),
      );
      const shell = {
        VITE_T3CODE_RELAY_URL: "https://relay.example.com",
        EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
        T3CODE_OTLP_TRACES_URL: "https://traces.example.com",
        T3CODE_POSTHOG_KEY: "phc_example",
        T3CODE_MOBILE_UPDATES_ENABLED: "1",
        T3CODE_TELEMETRY_ENABLED: "true",
        PATH: "/usr/bin",
      };
      const env = loadRepoEnv({ repoRoot: folder, baseEnv: shell });
      expect(Object.keys(env).filter(isCloudSwitch)).toEqual([]);
      expect(env.T3CODE_TELEMETRY_ENABLED).toBe("false");
      expect(env.PATH).toBe("/usr/bin");
    } finally {
      NodeFS.rmSync(folder, { recursive: true, force: true });
    }
  });

  it("builds a phone app that holds none of T3's identifiers with every switch on", async () => {
    const on = { ...everythingOn(), T3CODE_MOBILE_UPDATES_ENABLED: "1" };
    Object.assign(process.env, on);
    const config = await import(NodePath.join(repoRoot, "apps/mobile/app.config.ts"));
    const built = JSON.stringify(config.default);
    // The trace address is the config's own default, unused without a dataset and a token.
    const held = Object.entries(on)
      .filter(([name]) => isCloudSwitch(name) && name !== "T3CODE_MOBILE_OTLP_TRACES_URL")
      .filter(([, value]) => value.length > 3 && built.includes(value))
      .map(([name]) => name);
    expect(held).toEqual([]);
    expect(config.default.updates?.enabled).toBe(false);
  });

  it("catches a build that holds one of T3's identifiers, however it got there", () => {
    const identifiers = t3Identifiers(read(".env.example"));
    const on = everythingOn();
    const bundle = (name: string) => `const relay = "${on[name]}";`;
    expect(heldIdentifiers(bundle("T3CODE_RELAY_URL"), identifiers)).toEqual([
      ".env.example's T3CODE_RELAY_URL",
    ]);
    expect(heldIdentifiers(bundle("T3CODE_CLERK_PUBLISHABLE_KEY"), identifiers)).toEqual([
      ".env.example's T3CODE_CLERK_PUBLISHABLE_KEY",
    ]);
    expect(heldIdentifiers('fetch("https://ingest.t3.codes/capture")', identifiers)).toHaveLength(
      1,
    );
    expect(heldIdentifiers('open("https://app.t3.codes")', identifiers)).toEqual([]);
  });

  it("is each process's first import, and every build's loader", () => {
    const firstImport = (file: string) => /^\s*import\s[^;]*;/m.exec(read(file))?.[0];
    expect(firstImport("apps/server/src/bin.ts")).toBe('import "./stemcells/privacy/closed.ts";');
    expect(firstImport("apps/desktop/src/main.ts")).toBe('import "./stemcells/privacy/closed.ts";');
    expect(read("scripts/lib/public-config.ts")).toMatch(/\n {2}return closedBuildEnv\(\{\n/);
    const loaders = [
      "apps/server/vite.config.ts",
      "apps/web/vite.config.ts",
      "apps/desktop/vite.config.ts",
      "apps/mobile/app.config.ts",
      "scripts/dev-runner.ts",
    ];
    expect(loaders.filter((file) => !/\bloadRepoEnv\(\)/.test(read(file)))).toEqual([]);
  });
});

describe("no Stemcells process reaches T3's services", () => {
  it("refuses T3's hosts and the vendors upstream reports to, and no one else", () => {
    const refused = ["ingest.t3.codes", "relay.t3.codes", "T3.codes.", "us.i.posthog.com"];
    expect(refused.filter((host) => !isRefused(host))).toEqual([]);
    const reached = ["api.anthropic.com", "github.com", "nott3.codes", "t3.codes.example.com"];
    expect(reached.filter(isRefused)).toEqual([]);
  });

  it("answers no lookup of one, a fetch's included, and still answers the rest", async () => {
    const env: Record<string, string | undefined> = { T3CODE_RELAY_URL: "https://relay.t3.codes" };
    closeToT3(env);
    expect(env).toEqual({ T3CODE_TELEMETRY_ENABLED: "false" });

    const NodeDns = process.getBuiltinModule("node:dns");
    const failure = await new Promise<NodeJS.ErrnoException | null>((resolve) =>
      NodeDns.lookup("ingest.t3.codes", (error) => resolve(error)),
    );
    expect(failure?.code).toBe("ENOTFOUND");
    await expect(NodeDns.promises.lookup("relay.t3.codes")).rejects.toMatchObject({
      code: "ENOTFOUND",
    });
    const fetched = await fetch("https://ingest.t3.codes/capture").then(
      () => "answered",
      (error: { cause?: { message?: string } }) => error.cause?.message,
    );
    expect(fetched).toContain("Stemcells connects to no such host");
    await expect(NodeDns.promises.lookup("localhost")).resolves.toHaveProperty("address");
  });
});
