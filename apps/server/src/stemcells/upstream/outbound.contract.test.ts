// @effect-diagnostics nodeBuiltinImport:off - reads the server's source and the phone app's config on disk.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { describe, expect, it } from "vite-plus/test";

// Contract: what Stemcells keeps from leaving the machine besides analytics.
// The server never reads the provider logins to name the install's owners,
// the command line has no `t3 update` (it installs T3's release), and a phone
// build checks no over-the-air update source unless the build turns it on
// (the configured one is T3's). If this fails after a sync, one of them is
// back.

const serverSrc = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "../..",
);
const repoRoot = NodePath.resolve(serverSrc, "../../..");

const serverSources = () =>
  NodeFS.readdirSync(serverSrc, { recursive: true })
    .map(String)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file));

describe("what else Stemcells keeps on the machine", () => {
  it("reads no provider login to name the install's owners", () => {
    const readers = serverSources()
      .filter((file) => !file.startsWith(`telemetry${NodePath.sep}`))
      .filter((file) =>
        /\b(?:getServerOwners|getServerOwnersForHome|getTelemetryIdentity)\b/.test(
          NodeFS.readFileSync(NodePath.join(serverSrc, file), "utf8"),
        ),
      );
    expect(readers).toEqual([]);
  });

  it("offers no `t3 update` on the command line", () => {
    const cli = NodeFS.readFileSync(NodePath.join(serverSrc, "binCli.ts"), "utf8");
    expect(cli).not.toMatch(/\bupdateCommand\b|cli\/update\.ts/);
  });

  it("builds a phone app that checks no update source unless the build turns it on", async () => {
    const saved = process.env.T3CODE_MOBILE_UPDATES_ENABLED;
    delete process.env.T3CODE_MOBILE_UPDATES_ENABLED;
    try {
      const config = await import(NodePath.join(repoRoot, "apps/mobile/app.config.ts"));
      expect(config.default.updates?.enabled).toBe(false);
    } finally {
      if (saved !== undefined) process.env.T3CODE_MOBILE_UPDATES_ENABLED = saved;
    }
  });
});
