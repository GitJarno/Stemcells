/**
 * No Cell runs on Aski's provider instance, whose launch arguments carry
 * Aski's persona: the server refuses it, rather than trusting Aski's
 * instructions to keep Cells off it. A failure here after a sync names the
 * upstream gate that moved: the one every thread start and every message
 * asks whether its instance may run.
 */
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

const threadManagement = (dispatched: Array<ThreadId>) =>
  ThreadManagement.layer.pipe(
    Layer.provide(Layer.mock(ProviderSessionManager.ProviderSessionManagerV2)({})),
    Layer.provide(
      Layer.mock(Orchestrator.OrchestratorV2)({
        getShellSnapshot: () => Effect.succeed(shells),
        getThreadRecords: (threadId) =>
          Effect.succeed({
            thread: {
              id: threadId,
              projectId,
              deletedAt: null,
              modelSelection: { instanceId: askis, model: "m" },
            },
          } as unknown as OrchestrationV2ThreadProjection),
        dispatch: (command) =>
          Effect.sync(() => {
            if (command.type === "message.dispatch") dispatched.push(command.threadId);
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

it.effect("Aski's own chat still runs on its instance; another chat there is refused", () => {
  const dispatched: Array<ThreadId> = [];
  return Effect.gen(function* () {
    const threads = yield* ThreadManagement.ThreadManagementService;
    yield* threads.dispatch(message(askiChat, "aski"));
    const refused = yield* threads.dispatch(message(cell, "cell")).pipe(Effect.flip);
    assert.equal(refused.message, refusal);
    expect(dispatched).toEqual([askiChat]);
  }).pipe(Effect.provide(threadManagement(dispatched)));
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
