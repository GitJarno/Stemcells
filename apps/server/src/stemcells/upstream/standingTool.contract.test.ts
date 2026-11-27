import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  type RepositoryIdentity,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import * as McpToolAccessTestkit from "../../mcp/McpToolAccess.testkit.ts";
import * as ProjectStore from "../../orchestration-v2/ProjectStore.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as Needs from "../needs/Needs.ts";
import * as ReadScope from "./readScope.ts";
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
  Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
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
              since: null,
              holds: null,
              landing: null,
              brief: null,
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
        "Landed, awake (1):",
        "[Otter](t3-thread://v1/thread-otter) · Harbor · #281 merged",
      ].join("\n"),
    });
  }).pipe(Effect.provide(room)),
);

// With the read scope mounted, as the server mounts it (`layer.ts`): a Cell hears of its
// own repository's Cells, counts included, and Aski of every project's.

const repositoryOf = (name: string): RepositoryIdentity => ({
  canonicalKey: `github.com/example/${name}`,
  locator: {
    source: "git-remote",
    remoteName: "origin",
    remoteUrl: `https://github.com/example/${name}.git`,
  },
});
/** Harbor is checked out twice, Atlas is another repository. Only the id and repository are read. */
const projects = [
  { id: "project-harbor", title: "Harbor", repositoryIdentity: repositoryOf("harbor") },
  { id: "project-harbor-docs", title: "Harbor docs", repositoryIdentity: repositoryOf("harbor") },
  { id: "project-atlas", title: "Atlas", repositoryIdentity: repositoryOf("atlas") },
];
const landed = (threadId: string, projectId: string, title: string) => ({
  threadId,
  projectId,
  title,
  stage: "done" as const,
  line: "Done.",
  createdAt: "2026-10-24T08:00:00.000Z",
  since: null,
  holds: null,
  landing: null,
  brief: null,
});
const callers: Record<string, { readonly projectId: string; readonly instance: string }> = {
  "thread-otter": { projectId: "project-harbor", instance: "codex" },
  "thread-aski": { projectId: "project-home", instance: "aski" },
};

const scopedRoom = registerStandingTool(McpHttpServer.toolkitRegistration).pipe(
  Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
  Layer.provideMerge(ReadScope.layer),
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(ThreadManagementService.ThreadManagementService)({
        getThreadShell: (threadId) =>
          Effect.succeed({
            ...McpToolAccessTestkit.liveThreadShell(threadId),
            projectId: ProjectId.make(callers[threadId]!.projectId),
            providerInstanceId: ProviderInstanceId.make(callers[threadId]!.instance),
          }),
      }),
      Layer.mock(ProjectService.ProjectService)({
        listShells: () => Effect.succeed(projects as never),
      }),
      Layer.mock(Needs.Needs)({
        list: Effect.succeed({
          needs: [],
          later: [],
          cells: [
            landed("thread-badger", "project-harbor", "Badger"),
            landed("thread-wren", "project-harbor-docs", "Wren"),
            landed("thread-puma", "project-atlas", "Puma"),
          ],
        }),
      }),
      Layer.mock(ProjectStore.ProjectStoreV2)({
        listShells: () => Effect.succeed(projects as never),
      }),
    ),
  ),
);

it.effect(
  "a Cell reads where its own repository's Cells stand, and Aski where every Cell does",
  () =>
    Effect.gen(function* () {
      const server = yield* McpServer.McpServer;
      const standing = (threadId: string, instance: string) =>
        server.callTool({ name: "stemcells_standing", arguments: {} }).pipe(
          Effect.provideService(McpInvocationContext.McpInvocationContext, {
            ...invocation,
            thread: {
              ...invocation.thread,
              threadId: ThreadId.make(threadId),
              providerInstanceId: ProviderInstanceId.make(instance),
            },
          }),
          Effect.provideService(McpSchema.McpServerClient, client),
          Effect.map((result) => result.structuredContent),
        );

      expect(yield* standing("thread-otter", "codex")).toEqual({
        needsYou: 0,
        atWork: 0,
        done: 2,
        report: [
          "Nothing needs you.",
          "",
          "Landed, awake (2):",
          "[Badger](t3-thread://v1/thread-badger) · Harbor · Done.",
          "[Wren](t3-thread://v1/thread-wren) · Harbor docs · Done.",
        ].join("\n"),
      });
      expect(yield* standing("thread-aski", "aski")).toMatchObject({ done: 3 });
    }).pipe(Effect.provide(scopedRoom)),
);
