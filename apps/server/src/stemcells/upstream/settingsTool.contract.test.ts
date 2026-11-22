import { expect, it } from "@effect/vitest";
import {
  DEFAULT_SERVER_SETTINGS,
  EnvironmentId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as ProviderRegistry from "../../provider/ProviderRegistry.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { registerSettingsTool } from "./settingsTool.ts";

// Contract: a Cell reaches `stemcells_settings` through upstream's MCP server, behind its check
// that the caller is a live thread, and reads upstream's server settings, whose schema gives a
// value its words, and its provider registry.

const invocation = {
  environmentId: EnvironmentId.make("environment-settings-test"),
  requestNamespace: "provider-session-settings-test",
  thread: {
    threadId: ThreadId.make("thread-cell"),
    providerSessionId: "provider-session-settings-test",
    providerInstanceId: ProviderInstanceId.make("codex"),
  },
  client: undefined,
  capabilities: new Set<never>(),
  issuedAt: 1,
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "settings-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "settings-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const machine = registerSettingsTool(McpHttpServer.toolkitRegistration).pipe(
  Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
  Layer.provideMerge(McpToolAccessTestkit.liveThreadsLayer),
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(ServerSettings.ServerSettingsService)({
        getSettings: Effect.succeed({
          ...DEFAULT_SERVER_SETTINGS,
          sidebarAutoSettleOnMerge: false,
          responseStreamingMode: "turn",
        }),
      }),
      Layer.mock(ProviderRegistry.ProviderRegistry)({
        // Only what a card reads.
        getProviders: Effect.succeed([
          {
            instanceId: "codex",
            driver: "codex",
            enabled: true,
            installed: true,
            status: "ready",
            auth: { status: "unauthenticated" },
            models: [{ name: "GPT-5.5" }],
          },
        ] as never),
      }),
    ),
  ),
);

it.effect("a Cell reads a setting and a provider through upstream's MCP server", () =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const result = yield* server
      .callTool({
        name: "stemcells_settings",
        arguments: {
          paths: [
            "Threads › Auto-settle merged threads",
            "Threads › Response streaming",
            "Providers › Codex",
          ],
        },
      })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({
      report: [
        "Settings › Threads › Auto-settle merged threads: Off.",
        "Settings › Threads › Response streaming: Turn.",
        "Settings › Providers › Codex: Not signed in; models: GPT-5.5.",
      ].join("\n"),
    });
  }).pipe(Effect.provide(machine)),
);
