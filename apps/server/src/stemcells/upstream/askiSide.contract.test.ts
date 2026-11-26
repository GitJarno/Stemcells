/**
 * Aski's side (stemcells/tasks/aski-side.md) on upstream's own orchestrator and MCP server: the
 * shells `stemcells_show` picks Aski's chat from, the caller it checks, and the commands New Aski
 * dispatches to make the fresh chat Aski's and settle the one before by the person's hand.
 */
import { assert, expect, it } from "@effect/vitest";
import {
  CommandId,
  EnvironmentId,
  OrchestratorMcpFailure,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as TestClock from "effect/testing/TestClock";
import { McpSchema, McpServer } from "effect/ai";

import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import type * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { McpInvocationContext as InvocationContext } from "../../mcp/McpInvocationContext.ts";
import { CodexProviderCapabilitiesV2 } from "../../orchestration-v2/Adapters/CodexAdapterV2.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ProviderAdapterRegistry from "../../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ThreadManagement from "../../orchestration-v2/ThreadManagementService.ts";
import * as ProviderReplayHarness from "../../orchestration-v2/testkit/ProviderReplayHarness.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as ManagedProjectFolders from "../../project/ManagedProjectFolders.ts";
import { askiThreadOf } from "../needs/derive.ts";
import * as AskiFresh from "./askiFresh.ts";
import { latestHandSettles } from "./needs.ts";
import { registerShowTool } from "./showTool.ts";

const environmentId = EnvironmentId.make("environment:aski-side");
const project = ProjectId.make("project:aski-side");
const scratch = ProjectId.make("project:aski-side:scratch");
const askis = ProviderInstanceId.make("aski");
const codex = ProviderInstanceId.make("codex");

const adapter = (instanceId: ProviderInstanceId) =>
  ({
    instanceId,
    driver: ProviderDriverKind.make("codex"),
    getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
    planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
    openSession: () => Effect.die("No provider process: the effects are never run"),
  }) as ProviderAdapter.ProviderAdapterV2["Service"];

const layerDatabase = SqlitePersistence.layerMemory;
const layerOrchestrator = Layer.mergeAll(
  layerDatabase,
  OrchestrationEventStore.layer.pipe(Layer.provide(layerDatabase)),
  ProviderReplayHarness.layerWithRegistry(
    { name: "stemcells-aski-side" },
    ProviderAdapterRegistry.layerFromAdapters([adapter(codex), adapter(askis)]),
    { databaseLayer: layerDatabase, runEffectWorker: false },
  ),
);

/** Upstream's thread service as ours reads and writes through it, on the real orchestrator. */
const layerThreads = Layer.unwrap(
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    return Layer.mock(ThreadManagement.ThreadManagementService)({
      dispatch: orchestrator.dispatch,
      getShellSnapshot: (options) => orchestrator.getShellSnapshot(options),
      getThreadShell: orchestrator.getThreadShell,
    });
  }),
);

const layerTest = Layer.mergeAll(
  registerShowTool(McpHttpServer.toolkitRegistration).pipe(
    Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
  ),
  AskiFresh.layer,
).pipe(
  Layer.provideMerge(layerThreads),
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({
        namedProjectsRoot: "/projects",
        ensureScratchProject: Effect.succeed({ projectId: scratch }),
      }),
      SecureRandom.layerWebCrypto,
    ),
  ),
  Layer.provideMerge(layerOrchestrator),
);

const client = McpSchema.McpServerClient.of({
  clientId: 1,
  clientCapabilities: {},
  clientInfo: { name: "aski-side-test", version: "1.0.0" },
  protocolVersion: "2025-06-18",
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "aski-side-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const fromThread = (threadId: ThreadId): McpInvocationContext.McpInvocationScope => ({
  environmentId,
  requestNamespace: `session:${threadId}`,
  thread: { threadId, providerSessionId: `session:${threadId}`, providerInstanceId: askis },
  client: undefined,
  capabilities: new Set(["orchestration"]),
  issuedAt: 1,
});

const fromOutside: McpInvocationContext.McpInvocationScope = {
  environmentId,
  requestNamespace: "client:outside",
  thread: undefined,
  client: { sessionId: "client:outside", label: "Outside", access: "full-access" },
  capabilities: new Set(["orchestration"]),
  issuedAt: 1,
};

const call = (caller: McpInvocationContext.McpInvocationScope, input: Record<string, unknown>) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server
      .callTool({ name: "stemcells_show", arguments: input })
      .pipe(
        Effect.provideService(InvocationContext, caller),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
  });

/** What `stemcells_show` answers `caller`: the line shown, or the refusal. */
const show = (caller: McpInvocationContext.McpInvocationScope, input: Record<string, unknown>) =>
  Effect.gen(function* () {
    const result = yield* call(caller, input);
    if (!result.isError) {
      return { shown: (result.structuredContent as { readonly shown: string }).shown };
    }
    // A refusal comes back as its JSON in the text, as the caller's model reads it.
    const [first] = result.content;
    const text = first?.type === "text" ? first.text : "{}";
    return { refused: JSON.parse(text) as Partial<Pick<OrchestratorMcpFailure, "code">> };
  });

const create = (name: string, instanceId: ProviderInstanceId, title = name) =>
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    const threadId = ThreadId.make(`thread:aski-side:${name}`);
    yield* orchestrator.dispatch({
      type: "thread.create",
      commandId: CommandId.make(`create:${name}`),
      threadId,
      projectId: project,
      title,
      modelSelection: { instanceId, model: "gpt-5" },
      runtimeMode: "approval-required",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdBy: "user",
      creationSource: "web",
    });
    // Each made a minute after the last, as `askiThreadOf` ranks the unpinned by when.
    yield* TestClock.adjust("1 minute");
    return threadId;
  });

const command = (type: "thread.pin" | "thread.delete", threadId: ThreadId) =>
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    yield* orchestrator.dispatch({
      type,
      commandId: CommandId.make(`${type}:${threadId}`),
      threadId,
    });
  });

/** An earlier chat on Aski's instance, Aski's own (pinned, as its setup leaves it) and a Cell. */
const room = Effect.gen(function* () {
  const earlier = yield* create("earlier", askis, "Aski");
  const aski = yield* create("aski", askis, "Aski");
  yield* command("thread.pin", aski);
  const cell = yield* create("cell", codex, "Header tokens");
  const deleted = yield* create("deleted", codex);
  yield* command("thread.delete", deleted);
  return { earlier, aski, cell, deleted };
});

const askiOf = Effect.gen(function* () {
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  return askiThreadOf((yield* orchestrator.getShellSnapshot()).threads);
});

it.effect("stemcells_show answers Aski's own chat and refuses every other caller", () =>
  Effect.gen(function* () {
    const { earlier, aski, cell } = yield* room;
    expect(yield* askiOf).toBe(aski);

    expect(yield* show(fromThread(aski), { cell })).toEqual({
      shown: 'Shown: the Cell "Header tokens".',
    });
    expect(yield* show(fromThread(aski), { settings: "Settings › Providers › Codex" })).toEqual({
      shown: "Shown: Settings › Providers › Codex.",
    });
    expect(yield* show(fromThread(aski), { settings: "provider-codex" })).toEqual({
      shown: "Shown: Settings › Providers › Codex.",
    });
    expect(yield* show(fromThread(aski), { stage: "Flying" })).toEqual({
      shown: "Shown: the home's Flying stage.",
    });

    for (const caller of [fromThread(cell), fromThread(earlier)]) {
      expect((yield* show(caller, { stage: "Input" })).refused?.code).toBe("capability_denied");
    }
    // A client outside the app isn't offered it, and its call finds no such tool.
    const outside = yield* Effect.flip(call(fromOutside, { stage: "Input" }));
    expect(outside.message).toBe("Tool 'stemcells_show' not found");
  }).pipe(Effect.provide(layerTest)),
);

it.effect(
  "stemcells_show checks what it shows: one target, a Cell here, a place Settings has",
  () =>
    Effect.gen(function* () {
      const { aski, cell, deleted } = yield* room;
      const refusal = (input: Record<string, unknown>) =>
        Effect.map(show(fromThread(aski), input), (answer) => answer.refused?.code);

      expect(yield* refusal({})).toBe("invalid_request");
      expect(yield* refusal({ cell, stage: "Input" })).toBe("invalid_request");
      expect(yield* refusal({ settings: "Settings › Nowhere at all" })).toBe("invalid_request");
      expect(yield* refusal({ cell: deleted })).toBe("thread_not_found");
      expect(yield* refusal({ cell: "thread:aski-side:never" })).toBe("thread_not_found");
      // A stage by its wire name never reaches the tool: upstream's schema refuses it.
      const unknown = yield* Effect.flip(call(fromThread(aski), { stage: "working" }));
      expect(unknown.message).toContain("Invalid parameters for tool 'stemcells_show'");
    }).pipe(Effect.provide(layerTest)),
);

it.effect("New Aski pins a fresh chat as Aski's and settles the one before by hand", () =>
  Effect.gen(function* () {
    const { aski } = yield* room;
    const { fresh } = yield* AskiFresh.AskiFresh;
    const { threadId } = yield* fresh;

    expect(yield* askiOf).toBe(threadId);
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    const made = yield* orchestrator.getThreadShell(threadId);
    assert(made !== null);
    expect(made).toMatchObject({
      title: "Aski",
      projectId: scratch,
      providerInstanceId: askis,
      runtimeMode: "approval-required",
      interactionMode: "default",
      lineage: { parentThreadId: null },
    });
    expect(made.pinnedAt).not.toBeNull();
    const before = yield* orchestrator.getThreadShell(aski);
    expect(before).toMatchObject({ pinnedAt: null, settledOverride: "settled", deletedAt: null });

    // The settle counts as the person's, so every Mac closes the old chat's panes.
    const events = yield* OrchestrationEventStore.OrchestrationEventStore;
    expect((yield* latestHandSettles(events, [aski])).map((settle) => settle.threadId)).toEqual([
      aski,
    ]);

    // The chat before shows nothing now; the fresh one does.
    expect((yield* show(fromThread(aski), { stage: "Input" })).refused?.code).toBe(
      "capability_denied",
    );
    expect((yield* show(fromThread(threadId), { stage: "Input" })).shown).toBeDefined();
  }).pipe(Effect.provide(layerTest)),
);

it.effect("New Aski makes nothing where Aski has no chat yet: its setup makes the first", () =>
  Effect.gen(function* () {
    yield* create("cell", codex);
    const { fresh } = yield* AskiFresh.AskiFresh;
    const refused = yield* Effect.flip(fresh);
    expect(refused.reason).toBe("no-aski");
    expect(yield* askiOf).toBeNull();
  }).pipe(Effect.provide(layerTest)),
);
