/**
 * The guard that stops a Cell's resume firing twice (stemcells/tasks/limit-resume.md): the
 * orchestrator takes our continuation (`continueCommand`, upstream's
 * `manualContinuationOfRunId`) only while the stopped run is still the thread's latest. Once
 * anything ran after it, it is refused; a failure means our resume could land on another.
 */
import { assert, it } from "@effect/vitest";
import {
  CommandId,
  EventId,
  MessageId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  TurnItemId,
  type OrchestrationV2Run,
} from "@t3tools/contracts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import { CodexProviderCapabilitiesV2 } from "../../orchestration-v2/Adapters/CodexAdapterV2.ts";
import * as EventSink from "../../orchestration-v2/EventSink.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as ProviderAdapterRegistry from "../../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ProviderReplayHarness from "../../orchestration-v2/testkit/ProviderReplayHarness.ts";
import { continueCommand } from "./limitResume.ts";

const instanceId = ProviderInstanceId.make("codex");
const adapter = {
  instanceId,
  driver: ProviderDriverKind.make("codex"),
  getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
  planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
  openSession: () => Effect.die("No provider process: the effects are never run"),
} as ProviderAdapter.ProviderAdapterV2["Service"];
const layerDatabase = SqlitePersistence.layerMemory;
const layerTest = Layer.mergeAll(
  layerDatabase,
  ProjectionStore.layer.pipe(Layer.provide(layerDatabase)),
  ProviderReplayHarness.layerWithRegistry(
    { name: "stemcells-limit-resume-guard" },
    ProviderAdapterRegistry.layerFromAdapters([adapter]),
    { databaseLayer: layerDatabase, runEffectWorker: false },
  ),
);

/** A thread whose run a usage limit stopped, as the Claude and Codex adapters record it. */
const stoppedThread = (name: string) =>
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    const events = yield* EventSink.EventSinkV2;
    const threadId = ThreadId.make(`thread:${name}`);
    yield* orchestrator.dispatch({
      type: "thread.create",
      commandId: CommandId.make(`create:${name}`),
      threadId,
      projectId: ProjectId.make(`project:${name}`),
      title: "Limited Cell",
      modelSelection: { instanceId, model: "gpt-5" },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdBy: "user",
      creationSource: "web",
    });
    yield* orchestrator.dispatch({
      type: "message.dispatch",
      commandId: CommandId.make(`work:${name}`),
      threadId,
      messageId: MessageId.make(`work:${name}`),
      text: "Finish the header tokens.",
      attachments: [],
      dispatchMode: { type: "defer_start" },
      createdBy: "user",
      creationSource: "web",
    });
    const [run] = (yield* orchestrator.getThreadProjection(threadId)).runs as [OrchestrationV2Run];
    const now = yield* DateTime.now;
    yield* events.write({
      events: [
        {
          id: EventId.make(`stop:${name}`),
          type: "run.updated",
          threadId,
          occurredAt: now,
          payload: { ...run, status: "failed", completedAt: now },
        },
        {
          id: EventId.make(`refusal:${name}`),
          type: "turn-item.updated",
          threadId,
          occurredAt: now,
          payload: {
            id: TurnItemId.make(`refusal:${name}`),
            type: "error",
            threadId,
            runId: run.id,
            nodeId: run.rootNodeId,
            providerThreadId: null,
            providerTurnId: null,
            nativeItemRef: null,
            parentItemId: null,
            ordinal: 2,
            status: "failed",
            title: "Usage limit reached",
            startedAt: now,
            completedAt: now,
            updatedAt: now,
            failure: {
              class: "usage_limit",
              message: "Usage limit reached.",
              code: "usageLimitExceeded",
              retryable: null,
              resetAt: DateTime.formatIso(DateTime.add(now, { hours: 3 })),
            },
          },
        },
      ],
    });
    return { threadId, runId: run.id };
  });

const resume = (threadId: string, runId: string, nonce: string) =>
  continueCommand({ threadId, runId, reason: "signed-in", nonce });

it.layer(layerTest)("upstream's guard on a stopped Cell's continuation", (it) => {
  it.effect("takes the first continuation from the stopped run, and refuses a second", () =>
    Effect.gen(function* () {
      const orchestrator = yield* Orchestrator.OrchestratorV2;
      const { threadId, runId } = yield* stoppedThread("twice");
      yield* orchestrator.dispatch(resume(threadId, runId, "first"));
      assert.lengthOf((yield* orchestrator.getThreadProjection(threadId)).runs, 2);

      const second = yield* orchestrator
        .dispatch(resume(threadId, runId, "second"))
        .pipe(Effect.exit);
      assert.equal(second._tag, "Failure");
      assert.lengthOf((yield* orchestrator.getThreadProjection(threadId)).runs, 2);
    }),
  );

  it.effect("refuses it once the person's own message ran after the stop", () =>
    Effect.gen(function* () {
      const orchestrator = yield* Orchestrator.OrchestratorV2;
      const { threadId, runId } = yield* stoppedThread("person");
      yield* orchestrator.dispatch({
        type: "message.dispatch",
        commandId: CommandId.make("person:again"),
        threadId,
        messageId: MessageId.make("person:again"),
        text: "Try the footer next.",
        attachments: [],
        dispatchMode: { type: "start_immediately" },
        createdBy: "user",
        creationSource: "web",
      });
      const resumed = yield* orchestrator
        .dispatch(resume(threadId, runId, "late"))
        .pipe(Effect.exit);
      assert.equal(resumed._tag, "Failure");
      assert.lengthOf((yield* orchestrator.getThreadProjection(threadId)).runs, 2);
    }),
  );
});
