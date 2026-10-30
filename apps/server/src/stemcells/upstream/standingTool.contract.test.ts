import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as Needs from "../needs/Needs.ts";
import { registerStandingTool } from "./standingTool.ts";

// Contract: Aski reaches `stemcells_standing` through upstream's MCP server,
// registered as upstream registers its toolkits, behind its check that the
// caller is a live thread, and reads the room's list with project names from
// upstream's project store.

const invocation = {
  environmentId: EnvironmentId.make("environment-standing-test"),
  requestNamespace: "provider-session-standing-test",
  thread: {
    threadId: ThreadId.make("thread-aski"),
    providerSessionId: "provider-session-standing-test",
    providerInstanceId: ProviderInstanceId.make("aski"),
  },
  client: undefined,
  capabilities: new Set<never>(),
  issuedAt: 1,
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "standing-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "standing-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const room = registerStandingTool(McpHttpServer.toolkitRegistration).pipe(
  Layer.provideMerge(McpServer.McpServer.layer),
  Layer.provideMerge(McpToolAccessTestkit.liveThreadsLayer),
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(Needs.Needs)({
        list: Effect.succeed({
          needs: [],
          later: [],
          cells: [
            {
              threadId: "thread-otter",
              projectId: "project-harbor",
              title: "Otter",
              stage: "done",
              line: "#281 merged",
              createdAt: "2026-10-24T08:00:00.000Z",
            },
          ],
        }),
      }),
      Layer.mock(ProjectStore.ProjectStoreV2)({
        // Only the id and title are read.
        listShells: () => Effect.succeed([{ id: "project-harbor", title: "Harbor" }] as never),
      }),
    ),
  ),
);

it.effect("Aski reads where every Cell stands through upstream's MCP server", () =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const result = yield* server
      .callTool({ name: "stemcells_standing", arguments: {} })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({
      needsYou: 0,
      atWork: 0,
      done: 1,
      report: [
        "Nothing needs you.",
        "",
        "Done, not settled (1):",
        "[Otter](t3-thread://v1/thread-otter) · Harbor · #281 merged",
      ].join("\n"),
    });
  }).pipe(Effect.provide(room)),
);
