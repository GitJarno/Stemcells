// @effect-diagnostics nodeBuiltinImport:off - The fixture is real files, made with node:fs as the walk reads them.
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as ServerConfig from "../../config.ts";
import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as UpstreamDisk from "./disk.ts";
import { registerDiskTool } from "./diskTool.ts";

// Contract: a Cell reaches `stemcells_disk_report` through upstream's MCP
// server, registered as upstream registers its toolkits, and gets the
// machine's measurement: the first call walks the disk and waits for it, a
// second within the freshness reuses that walk.

const invocation = {
  environmentId: EnvironmentId.make("environment-disk-test"),
  requestNamespace: "provider-session-disk-test",
  thread: {
    threadId: ThreadId.make("thread-disk-test"),
    providerSessionId: "provider-session-disk-test",
    providerInstanceId: ProviderInstanceId.make("codex"),
  },
  client: undefined,
  capabilities: new Set<never>(),
  issuedAt: 1,
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "disk-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "disk-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const machine = (home: string) =>
  registerDiskTool(McpHttpServer.toolkitRegistration).pipe(
    Layer.provideMerge(McpServer.McpServer.layer),
    Layer.provideMerge(McpToolAccessTestkit.liveThreadsLayer),
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(UpstreamDisk.HostPlatform, "linux"),
        Layer.succeed(UpstreamDisk.HostHome, home),
        Layer.mock(ProjectStore.ProjectStoreV2)({ listShells: () => Effect.succeed([]) }),
        ServerConfig.layerTest(home, { prefix: "stemcells-disk-state-" }).pipe(
          Layer.provide(NodeServices.layer),
        ),
      ),
    ),
  );

const callReport = Effect.gen(function* () {
  const server = yield* McpServer.McpServer;
  const result = yield* server
    .callTool({ name: "stemcells_disk_report", arguments: {} })
    .pipe(
      Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
      Effect.provideService(McpSchema.McpServerClient, client),
    );
  expect(result.isError).toBe(false);
  return result.structuredContent as { readonly measured: boolean; readonly report: string };
});

const walkedAt = (report: string) =>
  report.split("\n").find((line) => line.startsWith("From a walk"));

it.live("a Cell's first report waits for the walk, and the next reuses it", () => {
  const home = NodeFS.realpathSync(
    NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "disk-home-")),
  );
  NodeFS.mkdirSync(NodePath.join(home, "app", "node_modules"), { recursive: true });
  NodeFS.writeFileSync(NodePath.join(home, "app", "node_modules", "dep.js"), "x".repeat(64_000));
  // The walk reads the user's temporary folder too: here, an empty one.
  const previousTemporary = process.env.TMPDIR;
  process.env.TMPDIR = NodeFS.mkdtempSync(NodePath.join(home, "tmp-"));
  return Effect.gen(function* () {
    const first = yield* callReport;
    expect(first.measured).toBe(true);
    expect(first.report).toContain("# What Stemcells measured on this computer");
    expect(first.report).toContain("Before removing anything");

    const second = yield* callReport;
    expect(second.measured).toBe(true);
    expect(walkedAt(second.report)).toBe(walkedAt(first.report));
  }).pipe(
    Effect.provide(machine(home)),
    Effect.ensuring(
      Effect.sync(() => {
        if (previousTemporary === undefined) delete process.env.TMPDIR;
        else process.env.TMPDIR = previousTemporary;
        NodeFS.rmSync(home, { recursive: true, force: true });
      }),
    ),
  );
});
