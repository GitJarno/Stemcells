/**
 * The arcs read what upstream's projection stores, written here by upstream's
 * own projection from its events: runs, the reply that ended each, the
 * person's messages and a Cell's requests. Autonomy reads a Cell's messages
 * through the same store (`upstream/autonomy.ts`). A failure after a sync
 * means they read the store as it no longer is.
 */
import { assert, it } from "@effect/vitest";
import {
  EventId,
  MessageId,
  NodeId,
  ProjectId,
  ProviderInstanceId,
  RunId,
  RuntimeRequestId,
  ThreadId,
  type ModelSelection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import { ASKI_INSTANCE_ID } from "../needs/derive.ts";
import { readArcRecords } from "./arcs.ts";

const layerTest = Layer.mergeAll(
  ProjectionStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)),
  SqlitePersistence.layerMemory,
);
const modelSelection = {
  instanceId: ProviderInstanceId.make("claudeAgent"),
  model: "claude-opus-5-5",
} as ModelSelection;
const AT = DateTime.makeUnsafe("2026-10-23T09:00:00.000Z");
const later = (minutes: number) => DateTime.add(AT, { minutes });

const chat = (name: string, options: { parent?: string; instance?: string } = {}) =>
  Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    const threadId = ThreadId.make(name);
    const runId = RunId.make(`run:${name}`);
    const nodeId = NodeId.make(`node:${name}`);
    const root = ThreadId.make(options.parent ?? name);
    yield* store.apply({
      id: EventId.make(`event:${name}:thread`),
      type: "thread.created",
      threadId,
      occurredAt: AT,
      payload: {
        createdBy: "user",
        creationSource: "web",
        id: threadId,
        projectId: ProjectId.make("project"),
        title: name,
        providerInstanceId: ProviderInstanceId.make(options.instance ?? "claudeAgent"),
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        activeProviderThreadId: null,
        lineage: {
          parentThreadId: options.parent === undefined ? null : root,
          relationshipToParent: options.parent === undefined ? null : "subagent",
          rootThreadId: root,
        },
        forkedFrom: null,
        createdAt: AT,
        updatedAt: AT,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        lastVisitedAt: null,
        deletedAt: null,
      },
    });
    const message = (
      id: string,
      role: "user" | "assistant",
      createdBy: "user" | "agent",
      text: string,
      minutes: number,
      creationSource: "web" | "provider" | "server" = createdBy === "user" ? "web" : "provider",
    ) =>
      store.apply({
        id: EventId.make(`event:${name}:${id}`),
        type: "message.updated",
        threadId,
        occurredAt: later(minutes),
        payload: {
          createdBy,
          creationSource,
          id: MessageId.make(`${name}:${id}`),
          threadId,
          runId: role === "assistant" ? runId : null,
          nodeId: role === "assistant" ? nodeId : null,
          role,
          text,
          attachments: [],
          streaming: false,
          createdAt: later(minutes),
          updatedAt: later(minutes),
        },
      });
    yield* message("ask", "user", "user", "Fix the header.", 0);
    yield* message("relay", "user", "agent", "The reviewer's notes.", 1);
    yield* store.apply({
      id: EventId.make(`event:${name}:run`),
      type: "run.created",
      threadId,
      occurredAt: AT,
      payload: {
        id: runId,
        threadId,
        ordinal: 1,
        providerInstanceId: modelSelection.instanceId,
        modelSelection,
        providerThreadId: null,
        userMessageId: MessageId.make(`${name}:ask`),
        rootNodeId: nodeId,
        activeAttemptId: null,
        status: "completed",
        requestedAt: AT,
        startedAt: AT,
        completedAt: later(20),
        checkpointId: null,
        contextHandoffId: null,
      },
    });
    yield* message("draft", "assistant", "agent", "Working on it.", 5);
    yield* message("reply", "assistant", "agent", "Merged.\n\n**Done:** #12 merged", 20);
    // Aski taking a card for the person, under their name but from the server: not their turn.
    yield* message("take", "user", "user", "Go ahead.", 25, "server");
    yield* store.apply({
      id: EventId.make(`event:${name}:request`),
      type: "runtime-request.updated",
      threadId,
      occurredAt: later(10),
      payload: {
        id: RuntimeRequestId.make(`request:${name}`),
        nodeId,
        providerTurnId: null,
        nativeRequestRef: null,
        kind: "user_input",
        status: "resolved",
        responseCapability: { type: "message" },
        createdAt: later(10),
        resolvedAt: later(12),
      },
    });
  });

it.layer(layerTest)("the arcs' records", (it) => {
  it.effect("are each Cell's runs with their last reply, the person's messages and its asks", () =>
    Effect.gen(function* () {
      yield* chat("pip");
      yield* chat("pip-reviewer", { parent: "pip" });
      yield* chat("aski", { instance: ASKI_INSTANCE_ID });
      const records = yield* readArcRecords("2026-10-23T00:00:00.000Z");
      assert.deepStrictEqual(records.runs, [
        {
          threadId: "pip",
          requestedAt: "2026-10-23T09:00:00.000Z",
          completedAt: "2026-10-23T09:20:00.000Z",
          status: "completed",
          reply: "Merged.\n\n**Done:** #12 merged",
        },
      ]);
      assert.deepStrictEqual(records.turns, [{ threadId: "pip", at: "2026-10-23T09:00:00.000Z" }]);
      assert.deepStrictEqual(records.requests, [
        {
          threadId: "pip",
          kind: "user_input",
          status: "resolved",
          createdAt: "2026-10-23T09:10:00.000Z",
          resolvedAt: "2026-10-23T09:12:00.000Z",
        },
      ]);
    }),
  );
});

it.layer(layerTest)("a Cell's messages, as autonomy reads them", (it) => {
  it.effect("say who made each: the person's screen, an agent, or the server in their name", () =>
    Effect.gen(function* () {
      yield* chat("otter");
      const store = yield* ProjectionStore.ProjectionStoreV2;
      const records = yield* store.getThreadRecords(ThreadId.make("otter"), ["messages"], {
        messageRoles: ["user"],
      });
      assert.deepStrictEqual(
        records.messages.map(({ text, createdBy, creationSource, scheduledTaskId }) => ({
          text,
          createdBy,
          creationSource,
          scheduled: scheduledTaskId !== undefined,
        })),
        [
          { text: "Fix the header.", createdBy: "user", creationSource: "web", scheduled: false },
          {
            text: "The reviewer's notes.",
            createdBy: "agent",
            creationSource: "provider",
            scheduled: false,
          },
          { text: "Go ahead.", createdBy: "user", creationSource: "server", scheduled: false },
        ],
      );
    }),
  );
});
