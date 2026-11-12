/**
 * The ledger reads what upstream's own projection stores from its events: a chat's thread, its
 * runs a page at a time with the reply that ended each, the requests that held each run,
 * through its nodes, and the pull requests on the thread. A failure after a sync means it reads the store as it no longer
 * is, and facts would go unrecorded without a word.
 */
import { assert, it } from "@effect/vitest";
import {
  EventId,
  MessageId,
  NodeId,
  type OrchestrationV2AppThread,
  type OrchestrationV2DomainEvent,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderSessionId,
  RunId,
  RuntimeRequestId,
  ThreadId,
  type ModelSelection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import { ASKI_INSTANCE_ID } from "../aski/instanceId.ts";
import {
  makesFact,
  openLedgerFile,
  readLedgerNewestRuns,
  readLedgerRuns,
  readLedgerThreads,
  readThreadIdsAfter,
} from "./ledger.ts";

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
const DRIVERS = new Map([["work", "claudeAgent"]]);

const threadOf = (
  name: string,
  options: { parent?: string; instance?: string; sideChat?: boolean } = {},
): OrchestrationV2AppThread => {
  const id = ThreadId.make(name);
  const root = ThreadId.make(options.parent ?? name);
  return {
    createdBy: "user",
    creationSource: "web",
    id,
    projectId: ProjectId.make("project"),
    title: name,
    providerInstanceId: ProviderInstanceId.make(options.instance ?? "work"),
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
      ...(options.sideChat === true ? { sideChat: true } : {}),
    },
    forkedFrom: null,
    createdAt: AT,
    updatedAt: AT,
    archivedAt: null,
    settledOverride: null,
    settledAt: null,
    lastVisitedAt: null,
    deletedAt: null,
  };
};

const created = (thread: OrchestrationV2AppThread) =>
  Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    yield* store.apply({
      id: EventId.make(`event:${thread.id}:thread`),
      type: "thread.created",
      threadId: thread.id,
      occurredAt: AT,
      payload: thread,
    });
  });

/** A run from minute `from` to minute `to` on `instance`, with its root node and its replies. */
const run = (
  thread: OrchestrationV2AppThread,
  ordinal: number,
  status: "completed" | "interrupted" | "running",
  from: number,
  to: number | null,
  replies: ReadonlyArray<string>,
  instance = "work",
) =>
  Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    const runId = RunId.make(`run:${thread.id}:${ordinal}`);
    const nodeId = NodeId.make(`node:${thread.id}:${ordinal}`);
    const asked: OrchestrationV2DomainEvent = {
      id: EventId.make(`event:${runId}`),
      type: "run.created",
      threadId: thread.id,
      occurredAt: later(from),
      payload: {
        id: runId,
        threadId: thread.id,
        ordinal,
        providerInstanceId: ProviderInstanceId.make(instance),
        modelSelection,
        providerThreadId: null,
        userMessageId: MessageId.make(`${runId}:ask`),
        rootNodeId: nodeId,
        activeAttemptId: null,
        status,
        requestedAt: later(from - 1),
        startedAt: later(from),
        completedAt: to === null ? null : later(to),
        checkpointId: null,
        contextHandoffId: null,
      },
    };
    yield* store.apply(asked);
    yield* store.apply({
      id: EventId.make(`event:${nodeId}`),
      type: "node.updated",
      threadId: thread.id,
      runId,
      nodeId,
      driver: ProviderDriverKind.make("claudeAgent"),
      occurredAt: later(from),
      payload: {
        id: nodeId,
        threadId: thread.id,
        runId,
        rootNodeId: nodeId,
        parentNodeId: null,
        kind: "root_turn",
        status: status === "running" ? "running" : "completed",
        countsForRun: true,
        providerThreadId: null,
        providerTurnId: null,
        nativeItemRef: null,
        runtimeRequestId: null,
        checkpointScopeId: null,
        startedAt: later(from),
        completedAt: to === null ? null : later(to),
      },
    });
    for (const [index, text] of replies.entries()) {
      yield* store.apply({
        id: EventId.make(`event:${runId}:reply:${index}`),
        type: "message.updated",
        threadId: thread.id,
        occurredAt: later(from + index),
        payload: {
          createdBy: "agent",
          creationSource: "provider",
          id: MessageId.make(`${runId}:reply:${index}`),
          threadId: thread.id,
          runId,
          nodeId,
          role: "assistant",
          text,
          attachments: [],
          streaming: false,
          createdAt: later(from + index),
          updatedAt: later(from + index),
        },
      });
    }
    return { runId, nodeId, heard: makesFact(asked) };
  });

const request = (
  thread: OrchestrationV2AppThread,
  nodeId: NodeId,
  name: string,
  capability: "live" | "message",
  from: number,
  to: number | null,
) =>
  Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    yield* store.apply({
      id: EventId.make(`event:${thread.id}:request:${name}`),
      type: "runtime-request.updated",
      threadId: thread.id,
      occurredAt: later(from),
      payload: {
        id: RuntimeRequestId.make(`request:${thread.id}:${name}`),
        nodeId,
        providerTurnId: null,
        nativeRequestRef: null,
        kind: "user_input",
        status: to === null ? "pending" : "resolved",
        responseCapability:
          capability === "message"
            ? { type: "message" }
            : { type: "live", providerSessionId: ProviderSessionId.make("session") },
        createdAt: later(from),
        resolvedAt: to === null ? null : later(to),
      },
    });
  });

it.layer(layerTest)("the ledger's records", (it) => {
  it.effect("are a Cell's thread, and its runs a page at a time with what held each", () =>
    Effect.gen(function* () {
      // It is on another provider now than the one its first run ran on.
      const pip = threadOf("pip", { instance: "later" });
      yield* created(pip);
      const first = yield* run(pip, 1, "completed", 0, 20, [
        "Working on it.",
        "Merged.\n\n**Done:** #12 merged",
        "  ",
      ]);
      yield* request(pip, first.nodeId, "held", "live", 5, 8);
      yield* request(pip, first.nodeId, "aside", "message", 10, null);
      const second = yield* run(pip, 2, "interrupted", 30, 31, ["Stopped."], "later");
      const third = yield* run(pip, 3, "running", 40, null, [], "later");
      // The tap reads for a chat's first run as it is asked for, when the chat is born, and
      // after that only for a run that landed.
      const wren = threadOf("wren");
      yield* created(wren);
      const only = yield* run(wren, 1, "running", 0, null, []);
      assert.deepStrictEqual(
        [first.heard, second.heard, third.heard, only.heard],
        [true, false, false, true],
      );
      // Not Cells: a subagent's thread, a side chat, Aski's own chat.
      yield* created(threadOf("pip-reviewer", { parent: "pip" }));
      yield* created(threadOf("pip-aside", { sideChat: true }));
      yield* created(threadOf("aski", { instance: ASKI_INSTANCE_ID }));

      assert.deepStrictEqual(
        yield* readLedgerThreads(["pip", "pip-reviewer", "pip-aside", "aski", "gone"], DRIVERS),
        [
          {
            threadId: "pip",
            projectId: "project",
            ran: true,
            driver: "claudeAgent",
            createdAt: "2026-10-23T09:00:00.000Z",
            settledAt: null,
            merged: [],
          },
        ],
      );
      assert.deepStrictEqual(yield* readLedgerRuns(["pip"], null, 2), [
        {
          threadId: "pip",
          runId: "run:pip:1",
          ordinal: 1,
          status: "completed",
          startedAt: "2026-10-23T09:00:00.000Z",
          completedAt: "2026-10-23T09:20:00.000Z",
          reply: "Merged.\n\n**Done:** #12 merged",
          // The request that held it; the one asked in a message, which didn't, is left out.
          requests: [
            { createdAt: "2026-10-23T09:05:00.000Z", resolvedAt: "2026-10-23T09:08:00.000Z" },
          ],
        },
        {
          threadId: "pip",
          runId: "run:pip:2",
          ordinal: 2,
          status: "interrupted",
          startedAt: "2026-10-23T09:30:00.000Z",
          completedAt: "2026-10-23T09:31:00.000Z",
          reply: null,
          requests: [],
        },
      ]);
      // A landing's read: the newest first, then the ones before.
      assert.deepStrictEqual(
        [yield* readLedgerNewestRuns("pip", null, 2), yield* readLedgerNewestRuns("pip", 2, 2)].map(
          (page) => page.map((each) => each.runId),
        ),
        [["run:pip:3", "run:pip:2"], ["run:pip:1"]],
      );
      // The next page starts after the last run read.
      assert.deepStrictEqual(
        (yield* readLedgerRuns(["pip"], { threadId: "pip", ordinal: 2 }, 2)).map((each) => [
          each.runId,
          each.status,
          each.completedAt,
        ]),
        [["run:pip:3", "running", null]],
      );
    }),
  );

  it.effect("say when a thread is settled and which pull requests merged, deleted or not", () =>
    Effect.gen(function* () {
      const store = yield* ProjectionStore.ProjectionStoreV2;
      const otter = threadOf("otter", { instance: "retired" });
      yield* created(otter);
      const link = (
        number: number,
        state: "open" | "merged",
        source: "agent" | "stack-dismissed",
      ) =>
        ({
          host: "example.com",
          repository: "team/website",
          number,
          url: `https://example.com/team/website/pull/${number}`,
          source,
          linkedAt: "2026-10-23T09:01:00.000Z",
          snapshot: {
            state,
            title: "A change",
            headBranch: "change",
            baseBranch: "main",
            isDraft: false,
            updatedAt: null,
            syncedAt: "2026-10-23T10:00:00.000Z",
            mergedAt: state === "merged" ? "2026-10-23T09:45:00Z" : null,
          },
          stack: null,
        }) as const;
      const after: OrchestrationV2AppThread = {
        ...otter,
        settledOverride: "settled",
        settledAt: later(50),
        deletedAt: later(60),
        pullRequests: [
          link(7, "merged", "agent"),
          link(8, "open", "agent"),
          link(9, "merged", "stack-dismissed"),
        ],
      };
      const events: ReadonlyArray<OrchestrationV2DomainEvent> = [
        {
          id: EventId.make("event:otter:synced"),
          type: "thread.pull-request-synced",
          threadId: otter.id,
          occurredAt: later(45),
          payload: after,
        },
        {
          id: EventId.make("event:otter:settled"),
          type: "thread.settled",
          threadId: otter.id,
          occurredAt: later(50),
          payload: after,
        },
        {
          id: EventId.make("event:otter:deleted"),
          type: "thread.deleted",
          threadId: otter.id,
          occurredAt: later(60),
          payload: after,
        },
      ];
      for (const event of events) yield* store.apply(event);

      assert.deepStrictEqual(yield* readLedgerThreads(["otter"], DRIVERS), [
        {
          threadId: "otter",
          projectId: "project",
          ran: false,
          // An instance no longer configured reads as its id.
          driver: "retired",
          createdAt: "2026-10-23T09:00:00.000Z",
          settledAt: "2026-10-23T09:50:00.000Z",
          merged: [
            { id: "example.com/team/website#7", number: 7, mergedAt: "2026-10-23T09:45:00Z" },
          ],
        },
      ]);
      // The events the tap reads for: these, a thread made and a run landing, and no others.
      assert.deepStrictEqual(events.map(makesFact), [true, true, false]);
    }),
  );

  it.effect("page through every thread's id", () =>
    Effect.gen(function* () {
      for (const name of ["c", "a", "b"]) yield* created(threadOf(`page-${name}`));
      const first = yield* readThreadIdsAfter("page-", 2);
      assert.deepStrictEqual(first, ["page-a", "page-b"]);
      assert.deepStrictEqual(
        (yield* readThreadIdsAfter(first.at(-1)!, 2)).filter((id) => id.startsWith("page-")),
        ["page-c"],
      );
    }),
  );

  it.effect("open a file of our own, apart from upstream's database", () =>
    Effect.gen(function* () {
      const own = yield* openLedgerFile(":memory:");
      yield* own`CREATE TABLE ours (name TEXT)`;
      const upstream = yield* SqlClient.SqlClient;
      const found = yield* upstream<{ readonly name: string }>`
        SELECT name FROM sqlite_schema WHERE name = 'ours'
      `;
      assert.deepStrictEqual(found, []);
    }),
  );
});
