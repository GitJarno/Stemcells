// @effect-diagnostics nodeBuiltinImport:off - reads t3_thread_send's service source.
/**
 * No Cell runs on Aski's provider instance, whose launch arguments carry
 * Aski's persona. The server refuses a Cell started there, rather than
 * trusting Aski's instructions to keep Cells off it, and a message to a Cell
 * made there before runs on the driver's own instance instead, whoever sends
 * it. A failure here after a sync names the upstream path that moved: the
 * gate every thread start asks whether its instance may run, and the one
 * dispatch every message takes.
 */
import * as NodeFS from "node:fs";

import { assert, expect, it } from "@effect/vitest";
import {
  CommandId,
  isUnconfiguredDefaultInstanceEnabled,
  MessageId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  type OrchestrationV2ThreadProjection,
  type OrchestrationV2ThreadShell,
  type OrchestrationV2ThreadShellSnapshot,
} from "@t3tools/contracts";
import * as IdAllocator from "@t3tools/provider-core/server/IdAllocator";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as GitWorkflow from "../../git/GitWorkflowService.ts";
import { dispatchFailure } from "../../mcp/threadAccess.ts";
import * as CommandReceiptStore from "../../orchestration-v2/CommandReceiptStore.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ProviderSessionManager from "../../orchestration-v2/ProviderSessionManager.ts";
import * as ThreadLaunch from "../../orchestration-v2/ThreadLaunchService.ts";
import * as ThreadManagement from "../../orchestration-v2/ThreadManagementService.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import * as ManagedProjectFolders from "../../project/ManagedProjectFolders.ts";
import * as ProjectCloneTracker from "../../project/ProjectCloneTracker.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as ProjectSetupScriptRunner from "../../project/ProjectSetupScriptRunner.ts";
import * as WorktreeSetupTracker from "../../project/WorktreeSetupTracker.ts";
import * as ProviderRegistry from "../../provider/ProviderRegistry.ts";
import * as ServerSettings from "../../serverSettings.ts";
import * as TerminalManager from "../../terminal/Manager.ts";
import * as TextGeneration from "../../textGeneration/TextGeneration.ts";
import { DEFAULT_INSTANCES } from "./askiInstance.ts";

const projectId = ProjectId.make("project:aski-instance");
const askis = ProviderInstanceId.make("aski");
const askiChat = ThreadId.make("thread:aski-instance:aski");
const cell = ThreadId.make("thread:aski-instance:cell");
const refusal = `Provider instance "aski" is Aski's own, and no Cell runs on it. Start the Cell on one of these instead: codex, claudeAgent.`;

/** Aski's instance as Aski's setup writes it: configured and on. */
const settings = ServerSettings.layerTest({
  providerInstances: { [askis]: { driver: "claudeAgent", enabled: true } },
});

const shell = (id: ThreadId, made: string, pinned: boolean) =>
  ({
    id,
    projectId,
    providerInstanceId: askis,
    lineage: { parentThreadId: null },
    deletedAt: null,
    pinnedAt: pinned ? DateTime.makeUnsafe(made) : null,
    createdAt: DateTime.makeUnsafe(made),
  }) as unknown as OrchestrationV2ThreadShell;

/** Aski's pinned chat, and a later chat on Aski's instance (one opened from Aski's tab). */
const shells = {
  threads: [
    shell(askiChat, "2026-10-20T08:00:00.000Z", true),
    shell(cell, "2026-10-21T08:00:00.000Z", false),
  ],
  archivedThreads: [],
} as unknown as OrchestrationV2ThreadShellSnapshot;

const receipts = CommandReceiptStore.layer.pipe(Layer.provide(SqlitePersistence.layerMemory));

const sendMessageId = MessageId.make("message:aski-instance:send");

/** What a dispatch sent on: the thread, and the instance named, if any. */
type Dispatched = { readonly threadId: ThreadId; readonly instanceId: string | undefined };

const threadManagement = (dispatched: Array<Dispatched>) =>
  ThreadManagement.layer.pipe(
    Layer.provide(Layer.mock(ProviderSessionManager.ProviderSessionManagerV2)({})),
    Layer.provide(
      Layer.mock(Orchestrator.OrchestratorV2)({
        getShellSnapshot: () => Effect.succeed(shells),
        // Every chat here sits on Aski's instance; the one message sent has queued its run.
        getThreadRecords: (threadId) =>
          Effect.succeed({
            thread: {
              id: threadId,
              projectId,
              deletedAt: null,
              archivedAt: null,
              modelSelection: { instanceId: askis, model: "m" },
            },
            runs: [{ id: "run:aski-instance:send", status: "queued" }],
            providerTurns: [],
            messages: [{ id: sendMessageId, runId: "run:aski-instance:send" }],
            turnItems: [],
          } as unknown as OrchestrationV2ThreadProjection),
        dispatch: (command) =>
          Effect.sync(() => {
            if (command.type === "message.dispatch") {
              dispatched.push({
                threadId: command.threadId,
                instanceId: command.modelSelection?.instanceId,
              });
            }
            return { sequence: 1, storedEvents: [] } as never;
          }),
      }),
    ),
    Layer.provide(settings),
    Layer.provideMerge(receipts),
  );

/** Upstream's launch, with only what it reads before it asks about the instance. */
const launches = ThreadLaunch.layer.pipe(
  Layer.provide(
    Layer.mock(ProjectService.ProjectService)({
      getById: () =>
        Effect.succeed(Option.some({ id: projectId, workspaceRoot: "/repo" } as never)),
    }),
  ),
  Layer.provide(
    Layer.mock(ProjectCloneTracker.ProjectCloneTracker)({ get: () => Effect.succeed(null) }),
  ),
  Layer.provide(Layer.mock(WorktreeSetupTracker.WorktreeSetupTracker)({})),
  Layer.provide(Layer.mock(TerminalManager.TerminalManager)({})),
  Layer.provide(Layer.mock(GitWorkflow.GitWorkflowService)({})),
  Layer.provide(Layer.mock(ProjectSetupScriptRunner.ProjectSetupScriptRunner)({})),
  Layer.provide(Layer.mock(ProviderRegistry.ProviderRegistry)({})),
  Layer.provide(Layer.mock(TextGeneration.TextGeneration)({})),
  Layer.provide(Layer.mock(IdAllocator.IdAllocatorV2)({} as never)),
  Layer.provide(
    Layer.mock(ManagedProjectFolders.ManagedProjectFolders)({ namedProjectsRoot: "/projects" }),
  ),
  Layer.provideMerge(threadManagement([])),
  Layer.provide(settings),
);

const message = (threadId: ThreadId, id: string) =>
  ({
    type: "message.dispatch",
    commandId: CommandId.make(`command:aski-instance:${id}`),
    threadId,
    messageId: MessageId.make(`message:aski-instance:${id}`),
    text: "Look at the failing build",
    attachments: [],
    dispatchMode: { type: "queue_after_active" },
    createdBy: "user",
    creationSource: "web",
  }) as const;

it.effect("a Cell launched on Aski's instance is refused, naming the instances it may use", () =>
  Effect.gen(function* () {
    const launch = yield* ThreadLaunch.ThreadLaunchService;
    const refused = yield* launch
      .launch({
        commandId: CommandId.make("command:aski-instance:launch"),
        threadId: ThreadId.make("thread:aski-instance:launched"),
        projectId,
        title: "Fix the build",
        modelSelection: { instanceId: askis, model: "m" },
        runtimeMode: "full-access",
        interactionMode: "default",
        workspaceStrategy: { type: "root" },
        initialMessage: {
          messageId: MessageId.make("message:aski-instance:launch"),
          text: "Fix it",
          attachments: [],
        },
        createdBy: "agent",
        creationSource: "mcp",
      })
      .pipe(Effect.flip);
    if (refused._tag !== "ThreadManagementProviderInstanceDisabledError") {
      assert.fail(`expected the instance refusal, got ${refused._tag}`);
    }
    assert.equal(refused.message, refusal);
    // Aski gets it as a plain tool error, as t3_thread_launch and the others hand it back.
    assert.deepInclude(dispatchFailure(refused), { code: "invalid_request", message: refusal });
  }).pipe(Effect.provide(launches)),
);

it.effect("t3_thread_send to a Cell on Aski's instance delivers it on the driver's own", () => {
  const dispatched: Array<Dispatched> = [];
  return Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    // What t3_thread_send hands upstream: no model, so the chat's own.
    const sent = yield* threads.sendToThread({
      projectId,
      commandId: CommandId.make("command:aski-instance:send"),
      threadId: cell,
      senderThreadId: askiChat,
      messageId: sendMessageId,
      text: "Look at the failing build",
      attachments: [],
      mode: "auto",
      createdBy: "agent",
      creationSource: "mcp",
    });
    assert.equal(sent.delivery, "queued");
    expect(dispatched).toEqual([{ threadId: cell, instanceId: "claudeAgent" }]);
  }).pipe(Effect.provide(threadManagement(dispatched)));
});

it.effect("a message naming Aski's instance moves a Cell too; Aski's own chat stays", () => {
  const dispatched: Array<Dispatched> = [];
  return Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    yield* threads.dispatch({
      ...message(cell, "cell"),
      modelSelection: { instanceId: askis, model: "m" },
    });
    yield* threads.dispatch(message(askiChat, "aski"));
    expect(dispatched).toEqual([
      { threadId: cell, instanceId: "claudeAgent" },
      { threadId: askiChat, instanceId: undefined },
    ]);
  }).pipe(Effect.provide(threadManagement(dispatched)));
});

it("t3_thread_send sends through upstream's thread management, naming no model", () => {
  const orchestratorMcp = NodeFS.readFileSync(
    new URL("../../mcp/OrchestratorMcpService.ts", import.meta.url),
    "utf8",
  );
  const send = orchestratorMcp.slice(
    orchestratorMcp.indexOf('sendToThread: Effect.fn("OrchestratorMcpService.sendToThread")'),
    orchestratorMcp.indexOf('waitForThread: Effect.fn("OrchestratorMcpService.waitForThread")'),
  );
  expect(send).toMatch(/yield\* threadManagement\s*\.sendToThread\(\{/);
  expect(send).not.toContain("modelSelection");
});

it.effect("a task delegated on Aski's instance is refused", () =>
  Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    const refused = yield* threads
      .assertProviderInstanceEnabled({
        projectId,
        commandId: CommandId.make("command:aski-instance:delegate"),
        instanceId: askis,
      })
      .pipe(Effect.flip);
    assert.equal(refused.message, refusal);
  }).pipe(Effect.provide(threadManagement([]))),
);

it("names the instances upstream enables before anything is configured", () => {
  for (const id of DEFAULT_INSTANCES) {
    expect(isUnconfiguredDefaultInstanceEnabled(ProviderInstanceId.make(id))).toBe(true);
  }
});
