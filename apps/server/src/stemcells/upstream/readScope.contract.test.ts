// @effect-diagnostics nodeBuiltinImport:off - reads upstream's launch handler from its source.
/**
 * What the read scope leans on (stemcells/tasks/aski-orchestrator.md, decision 10), driven
 * through upstream's own toolkits on its orchestrator. A failure means a Cell reads another
 * repository's chats, or lost one it should reach.
 */
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import {
  CommandId,
  EnvironmentId,
  MessageId,
  OrchestratorMcpFailure,
  ProjectId,
  ProviderInstanceId,
  type ServerProvider,
  ThreadId,
} from "@t3tools/contracts";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as SecretResolver from "@t3tools/secret-provider-core/server/SecretResolver";
import { checkpointWorkspace } from "@t3tools/provider-testing/replayWorkspace";
import { threadContextRecord } from "@t3tools/shared/composerContextReferences";
import { formatThreadLink } from "@t3tools/shared/threadLinks";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { McpSchema, McpServer, type Tool } from "effect/ai";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as McpHttpServer from "../../mcp/McpHttpServer.ts";
import * as McpInvocationContext from "../../mcp/McpInvocationContext.ts";
import { AttachmentToolkit } from "../../mcp/toolkits/attachment/tools.ts";
import { OrchestratorToolkit } from "../../mcp/toolkits/orchestrator/tools.ts";
import { ThreadToolkit } from "../../mcp/toolkits/thread/tools.ts";
import * as CommandReceiptStore from "../../orchestration-v2/CommandReceiptStore.ts";
import * as EffectWorker from "../../orchestration-v2/EffectWorker.ts";
import * as EventSink from "../../orchestration-v2/EventSink.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ProviderAdapterRegistry from "../../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ThreadLaunchService from "../../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as ThreadSearch from "../../orchestration-v2/ThreadSearch.ts";
import * as ProviderReplayHarness from "../../orchestration-v2/testkit/ProviderReplayHarness.ts";
import * as PeerForwarding from "../../peer/PeerForwarding.ts";
import * as PeerLinkRequests from "../../peer/PeerLinkRequests.ts";
import * as PeerLinks from "../../peer/PeerLinks.ts";
import * as RemoteDelegation from "../../peer/RemoteDelegation.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as ProviderRegistryMock from "../../provider/testUtils/providerRegistryMock.ts";
import * as ScheduledTaskService from "../../scheduledTasks/ScheduledTaskService.ts";
import * as SecretRequests from "../../secrets/SecretRequests.ts";
import * as ServerSettings from "../../serverSettings.ts";
import * as GitVcsDriver from "../../vcs/GitVcsDriver.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import { OTHER_PROJECT, refusalOf } from "../readScope/rule.ts";
import {
  driver,
  instanceId,
  KEEP_WORKING,
  type Read,
  readingAdapter,
} from "./readingProvider.testkit.ts";
import { fileReadScope } from "./readScope.ts";

const environmentId = EnvironmentId.make("environment:read-scope");
const model = "gpt-5";

const harbor = ProjectId.make("project:harbor");
const harborDocs = ProjectId.make("project:harbor-docs");
const atlas = ProjectId.make("project:atlas");
const home = ProjectId.make("project:home");
/** Harbor is checked out twice; Atlas is another repository; Aski's home has none. */
const repos = new Map<string, string>([
  [harbor, "github.com/example/harbor"],
  [harborDocs, "github.com/example/harbor"],
  [atlas, "github.com/example/atlas"],
]);

const otter = ThreadId.make("thread:otter");
const badger = ThreadId.make("thread:badger");
const wren = ThreadId.make("thread:wren");
const puma = ThreadId.make("thread:puma");
const lynx = ThreadId.make("thread:lynx");
const heron = ThreadId.make("thread:heron");
const kite = ThreadId.make("thread:kite");
const aski = ThreadId.make("thread:aski");

const provider: ServerProvider = {
  instanceId,
  driver,
  enabled: true,
  installed: true,
  version: "test",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-06-17T00:00:00.000Z",
  models: [{ slug: model, name: model, isCustom: false, capabilities: null }],
  slashCommands: [],
  skills: [],
};

const client = McpSchema.McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  clientCapabilities: {},
  clientInfo: { name: "read-scope-test", version: "1.0.0" },
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "read-scope-test", version: "1.0.0" },
  },
  getClient: Effect.die("unused"),
});

const callerOf = (
  threadId: ThreadId,
  providerInstanceId: ProviderInstanceId = instanceId,
): McpInvocationContext.McpInvocationScope => ({
  environmentId,
  requestNamespace: `session:${threadId}`,
  thread: { threadId, providerSessionId: `session:${threadId}`, providerInstanceId },
  client: undefined,
  capabilities: new Set(["orchestration"]),
  issuedAt: 1,
});

const outsideClient: McpInvocationContext.McpInvocationScope = {
  environmentId,
  requestNamespace: "client:read-scope",
  thread: undefined,
  client: { sessionId: "read-scope", label: "A client outside the app", access: "auto" },
  capabilities: new Set(["orchestration"]),
  issuedAt: 1,
};

const layerMemorySecretStore = Layer.sync(ServerSecretStore.ServerSecretStore, () => {
  const stored = new Map<string, Uint8Array>();
  return ServerSecretStore.ServerSecretStore.of({
    get: (name) => Effect.succeed(Option.fromNullishOr(stored.get(name))),
    set: (name, value) => Effect.sync(() => void stored.set(name, value)),
    create: (name, value) => Effect.sync(() => void stored.set(name, value)),
    getOrCreateRandom: (name, bytes) =>
      Effect.sync(() => {
        const value = stored.get(name) ?? new Uint8Array(bytes).fill(7);
        stored.set(name, value);
        return value;
      }),
    remove: (name) => Effect.sync(() => void stored.delete(name)),
  });
});

/** Upstream's orchestrator and its thread tools, as its own toolkit suites build them. */
const world = (searched: Ref.Ref<ReadonlyArray<ProjectId | undefined>>, cwd: string) => {
  const registry = ProviderAdapterRegistry.layerSingle(
    readingAdapter(Ref.makeUnsafe<ReadonlyArray<Read>>([])),
  );
  const orchestrator = ProviderReplayHarness.layerWithRegistry({ name: "read-scope" }, registry);
  const orchestration = Layer.merge(
    orchestrator,
    ThreadManagementService.layer.pipe(
      Layer.provide(orchestrator),
      Layer.provide(ServerSettings.layerTest()),
      Layer.provide(CommandReceiptStore.layer.pipe(Layer.provide(SqlitePersistence.layerMemory))),
    ),
  );
  const toolkits = Layer.mergeAll(
    McpHttpServer.layerOrchestratorToolkit.pipe(
      Layer.provide(Layer.mock(ThreadLaunchService.ThreadLaunchService)({})),
      Layer.provide(Layer.mock(GitVcsDriver.GitVcsDriver)({})),
    ),
    McpHttpServer.layerThreadToolkit.pipe(
      Layer.provide(
        Layer.mock(ThreadSearch.ThreadSearch)({
          searchThreads: (input) =>
            Ref.update(searched, (all) => [...all, input.projectId]).pipe(
              Effect.as({ matches: [] }),
            ),
        }),
      ),
    ),
  );
  return toolkits.pipe(
    Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
    Layer.provideMerge(orchestration),
    Layer.provide(registry.pipe(Layer.provide(McpProviderSessions.layer))),
    Layer.provide(ProviderRegistryMock.layer([provider])),
    Layer.provide(ServerSettings.layerTest()),
    Layer.provide(Layer.mock(ScheduledTaskService.ScheduledTaskService)({})),
    Layer.provide(Layer.mock(PeerForwarding.PeerForwarding)({})),
    Layer.provide(Layer.mock(PeerLinkRequests.PeerLinkRequests)({})),
    Layer.provide(Layer.mock(PeerLinks.PeerLinks)({})),
    Layer.provide(
      Layer.mock(ProjectService.ProjectService)({
        workspaceScanDirectory: Effect.succeed,
        // Only that the project exists, and its folder, are read.
        getById: (id) => Effect.succeedSome({ id, workspaceRoot: cwd } as never),
      }),
    ),
    Layer.provideMerge(
      SecretRequests.layer.pipe(
        Layer.provide(layerMemorySecretStore),
        Layer.provide(Layer.mock(SecretResolver.SecretResolver)({})),
        Layer.provide(orchestration),
      ),
    ),
    Layer.provide(Layer.mock(RemoteDelegation.RemoteDelegation)({})),
    Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  );
};

const create = (
  threadId: ThreadId,
  projectId: ProjectId,
  title: string,
  cwd: string,
  onInstance: ProviderInstanceId = instanceId,
) =>
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    yield* orchestrator.dispatch({
      type: "thread.create",
      commandId: CommandId.make(`create:${threadId}`),
      threadId,
      projectId,
      title,
      modelSelection: { instanceId: onInstance, model },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: cwd,
      createdBy: "user",
      creationSource: "web",
    });
  });

/** Waits, from now, for the thread's provider turn to run, or for its run to complete. */
const next = (threadId: ThreadId, status: "running" | "completed") =>
  Effect.gen(function* () {
    const sink = yield* EventSink.EventSinkV2;
    return yield* sink
      .stream({ threadId, afterSequence: yield* sink.latestSequence({ threadId }) })
      .pipe(
        Stream.map((stored) => stored.event),
        Stream.filter((event) =>
          status === "running"
            ? event.type === "provider-turn.updated" && event.payload.status === "running"
            : event.type === "run.updated" && event.payload.status === "completed",
        ),
        Stream.take(1),
        Stream.runDrain,
        Effect.forkScoped,
      );
  });

const refusal = (result: McpSchema.CallToolResult) => {
  const text = result.content[0];
  return result.isError === true && text?.type === "text"
    ? (JSON.parse(text.text) as { readonly code: string; readonly message: string })
    : undefined;
};

interface Listing {
  readonly projectId: string | null;
  readonly threads: ReadonlyArray<{ readonly threadId: string }>;
  readonly nextCursor: number | null;
  readonly total: number;
}

it.live(
  "a Cell's tools reach its own repository's chats, its family, what it launched and what the person attached; Aski and a client outside reach every chat",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const cwd = yield* checkpointWorkspace("stemcells-read-scope");
        const searched = yield* Ref.make<ReadonlyArray<ProjectId | undefined>>([]);
        yield* Effect.gen(function* () {
          const orchestrator = yield* Orchestrator.OrchestratorV2;
          const worker = yield* EffectWorker.OrchestrationEffectWorkerV2;
          const server = yield* McpServer.McpServer;
          yield* fileReadScope({
            threads: yield* ThreadManagementService.ThreadManagementService,
            repos: Effect.succeed(repos),
          });
          const call = (
            scope: McpInvocationContext.McpInvocationScope,
            name: string,
            args: Record<string, unknown>,
          ) =>
            server
              .callTool({ name, arguments: args })
              .pipe(
                Effect.provideService(McpInvocationContext.McpInvocationContext, scope),
                Effect.provideService(McpSchema.McpServerClient, client),
              );
          const asOtter = (name: string, args: Record<string, unknown>) =>
            call(callerOf(otter), name, args);
          const listed = (result: McpSchema.CallToolResult) => result.structuredContent as Listing;
          const idsOf = (result: McpSchema.CallToolResult) =>
            listed(result).threads.map((thread) => thread.threadId);

          yield* create(otter, harbor, "Migrations", cwd);
          yield* create(badger, harbor, "Schema", cwd);
          yield* create(wren, harborDocs, "Guides", cwd);
          yield* create(puma, atlas, "Payroll export", cwd);
          yield* create(lynx, atlas, "Rate limits", cwd);
          yield* create(heron, atlas, "Retry policy", cwd);
          yield* create(kite, atlas, "Asked from Harbor", cwd);
          yield* create(aski, home, "Aski", cwd, ProviderInstanceId.make(ASKI_INSTANCE_ID));

          // Otter started Kite, as `t3_thread_launch` does: its first message names Otter.
          const kiteDone = yield* next(kite, "completed");
          yield* orchestrator.dispatch({
            type: "message.dispatch",
            commandId: CommandId.make("send:otter-launches-kite"),
            threadId: kite,
            messageId: MessageId.make("message:otter-launches-kite"),
            senderThreadId: otter,
            text: "Which retry policy does Atlas use?",
            attachments: [],
            dispatchMode: { type: "start_immediately" },
            createdBy: "agent",
            creationSource: "mcp",
          });
          yield* Fiber.join(kiteDone);
          // Another Cell's message that links Puma gives Otter no reach: only the person attaches.
          const told = yield* next(otter, "completed");
          yield* orchestrator.dispatch({
            type: "message.dispatch",
            commandId: CommandId.make("send:badger-links-puma"),
            threadId: otter,
            messageId: MessageId.make("message:badger-links-puma"),
            senderThreadId: badger,
            text: `Read ${formatThreadLink({ environmentId, threadId: puma }, "Payroll export")}.`,
            attachments: [],
            dispatchMode: { type: "start_immediately" },
            createdBy: "agent",
            creationSource: "mcp",
          });
          yield* Fiber.join(told);
          // The person attaches Lynx as a chip and Heron as a pasted link; Otter's turn runs on.
          const running = yield* next(otter, "running");
          yield* orchestrator.dispatch({
            type: "message.dispatch",
            commandId: CommandId.make("send:person-attaches"),
            threadId: otter,
            messageId: MessageId.make("message:person-attaches"),
            text: `Match ${formatThreadLink({ environmentId, threadId: heron }, "Retry policy")}. ${KEEP_WORKING}`,
            context: {
              version: 1,
              records: [threadContextRecord({ environmentId, threadId: lynx }, "Rate limits")],
            },
            attachments: [],
            dispatchMode: { type: "start_immediately" },
            createdBy: "user",
            creationSource: "web",
          });
          yield* Fiber.join(running);
          yield* worker.drain();

          // Lists: the Cell's project, then its repository, with one count and one cursor.
          const own = yield* asOtter("t3_thread_list", {});
          expect(idsOf(own).toSorted()).toEqual([badger, otter]);
          const repository = yield* asOtter("t3_thread_list", { allProjects: true });
          expect(idsOf(repository).toSorted()).toEqual([badger, otter, wren]);
          expect(listed(repository)).toMatchObject({ projectId: null, total: 3, nextCursor: null });
          const firstPage = yield* asOtter("t3_thread_list", { allProjects: true, limit: 2 });
          expect(listed(firstPage)).toMatchObject({ total: 3, nextCursor: 2 });
          expect(idsOf(firstPage).toSorted()).toEqual([badger, otter]);
          const secondPage = yield* asOtter("t3_thread_list", {
            allProjects: true,
            limit: 2,
            cursor: 2,
          });
          expect(listed(secondPage)).toMatchObject({ total: 3, nextCursor: null });
          expect(idsOf(secondPage)).toEqual([wren]);
          expect(idsOf(yield* asOtter("t3_thread_list", { projectId: harborDocs }))).toEqual([
            wren,
          ]);
          expect(refusal(yield* asOtter("t3_thread_list", { projectId: atlas }))).toMatchObject({
            code: "capability_denied",
            message: OTHER_PROJECT,
          });

          // Search: upstream's handler searches the caller's project when none is named.
          expect((yield* asOtter("t3_thread_search", { query: "payroll" })).isError).toBe(false);
          expect(
            refusal(yield* asOtter("t3_thread_search", { query: "payroll", projectId: atlas })),
          ).toMatchObject({ code: "capability_denied", message: OTHER_PROJECT });
          expect(yield* Ref.get(searched)).toEqual([harbor]);

          // Reads and waits.
          for (const reached of [badger, wren, lynx, heron, kite]) {
            const read = yield* asOtter("t3_thread_read", { threadId: reached });
            expect(refusal(read), reached).toBeUndefined();
            expect(read.structuredContent, reached).toMatchObject({
              thread: { threadId: reached },
            });
          }
          expect(refusal(yield* asOtter("t3_thread_read", { threadId: puma }))).toMatchObject({
            code: "capability_denied",
            message: refusalOf("t3_thread_read"),
          });
          expect(refusal(yield* asOtter("t3_thread_wait", { threadId: puma }))).toMatchObject({
            code: "capability_denied",
            message: refusalOf("t3_thread_wait"),
          });
          expect((yield* asOtter("t3_thread_wait", { threadId: lynx })).isError).toBe(false);
          expect((yield* asOtter("t3_thread_wait", { threadId: kite })).isError).toBe(false);

          // Writes: another repository's chat is refused, an attached one too; its own is sent.
          for (const threadId of [puma, lynx]) {
            expect(
              refusal(yield* asOtter("t3_thread_send", { threadId, message: "Use 0043." })),
              threadId,
            ).toMatchObject({ code: "capability_denied", message: refusalOf("t3_thread_send") });
            expect(
              refusal(yield* asOtter("t3_queue", { action: "list", threadId })),
              threadId,
            ).toMatchObject({ code: "capability_denied", message: refusalOf("t3_queue") });
          }
          expect((yield* orchestrator.getThreadProjection(puma)).messages).toEqual([]);
          const sent = yield* asOtter("t3_thread_send", {
            threadId: badger,
            message: "I took migration 0043.",
          });
          expect(refusal(sent)).toBeUndefined();

          // A delegated child: its parent reads it, waits on it and reads its task, as before.
          const delegated = yield* asOtter("delegate_task", {
            task: "Check the migration order.",
            target: { providerInstanceId: instanceId, model },
            mode: "async",
            clientRequestId: "delegate-read-scope",
          });
          expect(refusal(delegated)).toBeUndefined();
          const { childThreadId, taskId } = delegated.structuredContent as {
            readonly childThreadId: ThreadId;
            readonly taskId: string;
          };
          const waited = yield* asOtter("t3_thread_wait", { threadId: childThreadId });
          expect(refusal(waited)).toBeUndefined();
          expect(
            (yield* asOtter("t3_thread_read", { threadId: childThreadId })).structuredContent,
          ).toMatchObject({ thread: { threadId: childThreadId, parentThreadId: otter } });
          expect(refusal(yield* asOtter("task_status", { taskId }))).toBeUndefined();

          // The Subcell reads within its Cell's scope: its parent, what the person attached there.
          const asSubcell = (name: string, args: Record<string, unknown>) =>
            call(callerOf(childThreadId), name, args);
          for (const reached of [otter, badger, lynx]) {
            expect(
              refusal(yield* asSubcell("t3_thread_read", { threadId: reached })),
              reached,
            ).toBeUndefined();
          }
          expect(refusal(yield* asSubcell("t3_thread_read", { threadId: puma }))).toMatchObject({
            code: "capability_denied",
          });

          // Aski's chat and a client outside the app reach every chat, as before.
          for (const scope of [
            callerOf(aski, ProviderInstanceId.make(ASKI_INSTANCE_ID)),
            outsideClient,
          ]) {
            const everywhere = yield* call(scope, "t3_thread_list", {
              allProjects: true,
              includeSubagents: false,
              limit: 50,
            });
            expect(idsOf(everywhere).toSorted()).toEqual(
              [aski, badger, heron, kite, lynx, otter, puma, wren].toSorted(),
            );
            expect(
              (yield* call(scope, "t3_thread_read", { threadId: puma })).structuredContent,
            ).toMatchObject({ thread: { threadId: puma } });
            expect(
              refusal(
                yield* call(scope, "t3_thread_search", { query: "payroll", projectId: atlas }),
              ),
            ).toBeUndefined();
          }
        }).pipe(Effect.provide(world(searched, cwd)));
      }),
    ),
);

it("every upstream tool that names a chat names it in a parameter the gate reads, and can say its refusal", () => {
  const tools: Record<string, Tool.Any> = {
    ...OrchestratorToolkit.tools,
    ...ThreadToolkit.tools,
    ...AttachmentToolkit.tools,
  };
  const naming = Object.entries(tools).flatMap(([name, tool]) => {
    const fields = Object.keys(
      (tool.parametersSchema as { readonly fields?: Record<string, unknown> }).fields ?? {},
    ).filter((field) => /threadid$/i.test(field));
    return fields.length === 0 ? [] : [[name, fields, tool.failureSchema] as const];
  });
  expect(naming.map(([name, fields]) => `${name}: ${fields.join(", ")}`).toSorted()).toEqual([
    "t3_pending_request: threadId",
    "t3_queue: threadId",
    "t3_thread_configure: threadId",
    "t3_thread_interrupt: threadId",
    "t3_thread_organize: threadId",
    "t3_thread_read: threadId",
    "t3_thread_send: threadId",
    "t3_thread_send_attachments: threadId",
    "t3_thread_transfer: threadId, targetThreadId",
    "t3_thread_update: threadId",
    "t3_thread_wait: threadId",
    "t3_workflow_stop: threadId",
  ]);
  expect(naming.filter(([, , failure]) => failure !== OrchestratorMcpFailure)).toEqual([]);
  // The two that scope by project are the ones the gate knows by name.
  for (const name of ["t3_thread_list", "t3_thread_search"]) {
    expect(
      Object.keys((tools[name]!.parametersSchema as never as { fields: object }).fields),
    ).toContain("projectId");
    expect(tools[name]!.failureSchema).toBe(OrchestratorMcpFailure);
  }
});

it("upstream's launch stamps the chat's first message with the Cell that launched it", () => {
  // `tiesOf` reads a launched chat from that stamp; a launch runs too much to drive here.
  const source = NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL("../../mcp/toolkits/project/handlers.ts", import.meta.url)),
    "utf8",
  );
  const launch = source.slice(source.indexOf("ThreadMessageIntake.launchThread({"));
  expect(launch.slice(0, launch.indexOf("createdBy:"))).toContain(
    "...(caller === undefined ? {} : { senderThreadId: caller.id }),",
  );
});

it("Stemcells' server layer mounts the gate: unmounted, every Cell reads every chat", () => {
  const source = NodeFS.readFileSync(
    NodeURL.fileURLToPath(new URL("../layer.ts", import.meta.url)),
    "utf8",
  );
  expect(source).toMatch(/Layer\.mergeAll\([^)]*\bReadScope\.layer,/);
});
