// @effect-diagnostics nodeBuiltinImport:off
import { expect, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { symlinksSupported } from "@t3tools/shared/testing/symlinks";
import * as Effect from "effect/Effect";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as HttpClient from "effect/http/HttpClient";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

import * as ProviderLatestVersions from "./ProviderLatestVersions.ts";
import {
  enrichProviderSnapshotWithVersionAdvisory,
  makePackageManagedProviderMaintenanceResolver,
  resolveProviderMaintenanceCapabilitiesEffect,
} from "./maintenanceResolver.ts";

// npm's `min-release-age` makes `npm install -g <pkg>@latest` take the newest release old
// enough and exit 0, so an advisory read from the registry's tag offered an update that never
// installed. The advertised version is npm's own answer for the install's prefix.

const windowsHost = HostProcess.Platform.defaultValue() === "win32";
const PACKAGE = "@example/package-tool";

const resolver = makePackageManagedProviderMaintenanceResolver({
  provider: ProviderDriverKind.make("packageTool"),
  npmPackageName: PACKAGE,
  nativeUpdate: null,
});

const installed: ServerProvider = {
  instanceId: ProviderInstanceId.make("packageTool"),
  driver: ProviderDriverKind.make("packageTool"),
  enabled: true,
  installed: true,
  version: "1.0.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-04-10T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
};

function writeExecutable(path: string) {
  NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true });
  NodeFS.writeFileSync(path, "#!/bin/sh\n");
  NodeFS.chmodSync(path, 0o755);
}

/** An npm global prefix with the package installed and its bin linked, plus an `npm` to find. */
function npmPrefix() {
  const prefix = NodeFS.mkdtempSync(
    NodePath.join(NodeFS.realpathSync(NodeOS.tmpdir()), "stemcells-npm-age-"),
  );
  const target = NodePath.join(prefix, "lib", "node_modules", "@example", "package-tool", "bin");
  writeExecutable(NodePath.join(target, "package-tool.js"));
  NodeFS.mkdirSync(NodePath.join(prefix, "bin"), { recursive: true });
  const link = NodePath.join(prefix, "bin", "package-tool");
  NodeFS.symlinkSync(NodePath.join(target, "package-tool.js"), link);
  writeExecutable(NodePath.join(prefix, "bin", "npm"));
  return { prefix, link };
}

function npmSpawner(
  calls: Array<ReadonlyArray<string>>,
  answer: { readonly outdated: string; readonly exitCode: number; readonly ls: string },
) {
  return ChildProcessSpawner.make((command) => {
    const { args } = command as unknown as { readonly args: ReadonlyArray<string> };
    calls.push(args);
    const outdated = args[0] === "outdated";
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(outdated ? answer.exitCode : 0)),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        unref: Effect.succeed(Effect.void),
        stdin: Sink.drain,
        stdout: Stream.encodeText(Stream.make(outdated ? answer.outdated : answer.ls)),
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
      }),
    );
  });
}

const LISTED = JSON.stringify({ dependencies: { [PACKAGE]: { version: "1.0.0" } } });

it.layer(NodeServices.layer)("npm-global installs under min-release-age", (it) => {
  it.effect.each([
    {
      case: "the newest release npm would install",
      outdated: JSON.stringify({ [PACKAGE]: { current: "1.0.0", latest: "1.1.0" } }),
      exitCode: 1,
      expected: "1.1.0",
    },
    {
      case: "no update while every newer release is too young",
      outdated: "{}",
      exitCode: 0,
      expected: "1.0.0",
    },
    {
      case: "the registry's tag when npm itself fails",
      outdated: JSON.stringify({ error: { code: "ENOTFOUND", summary: "offline" } }),
      exitCode: 1,
      expected: "9.9.9",
    },
  ])(
    "advertises $case",
    (fixture) =>
      Effect.gen(function* () {
        const { prefix, link } = npmPrefix();
        const calls: Array<ReadonlyArray<string>> = [];
        const capabilities = yield* resolveProviderMaintenanceCapabilitiesEffect(resolver, {
          binaryPath: link,
          env: { PATH: "" },
        }).pipe(
          Effect.provideService(HostProcess.Environment, { PATH: NodePath.join(prefix, "bin") }),
          Effect.provideService(
            ChildProcessSpawner.ChildProcessSpawner,
            npmSpawner(calls, { ...fixture, ls: LISTED }),
          ),
        );

        const provider = yield* enrichProviderSnapshotWithVersionAdvisory(
          installed,
          capabilities,
        ).pipe(
          Effect.provideServiceEffect(
            ProviderLatestVersions.ProviderLatestVersions,
            ProviderLatestVersions.make([[PACKAGE, "9.9.9"]]),
          ),
          Effect.provideService(
            HttpClient.HttpClient,
            HttpClient.make(() => Effect.die("the registry's version is already cached")),
          ),
        );

        expect(provider.versionAdvisory).toMatchObject({
          status: fixture.expected === "1.0.0" ? "current" : "behind_latest",
          currentVersion: "1.0.0",
          latestVersion: fixture.expected,
        });
        // Asked of the prefix the update installs into, as the update command's own npm reads it.
        expect(calls[0]).toEqual(["outdated", "-g", "--prefix", prefix, "--json", PACKAGE]);
      }),
    { skip: !symlinksSupported || windowsHost },
  );
});
