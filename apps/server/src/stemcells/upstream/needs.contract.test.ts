/**
 * Upstream shapes Aski's needs list reads (stemcells/tasks/aski-room.md,
 * "What T3 gives us to build on"). A failure here after a sync names what
 * moved: a request kind with no card, a run status the list doesn't place,
 * or a shell field the fixtures no longer match.
 */
import {
  CheckpointId,
  CheckpointRef,
  CheckpointScopeId,
  CommandId,
  EventId,
  MessageId,
  NodeId,
  OrchestrationV2ProviderFailureClass,
  OrchestrationV2RunStatus,
  OrchestrationV2RuntimeRequest,
  OrchestrationV2StoredEvent,
  OrchestrationV2ThreadShell,
  OrchestrationV2TurnItem,
  OrchestrationV2UserInputQuestion,
  ProjectId,
  ProviderApprovalFullAccessOverride,
  ProviderInstanceId,
  TurnItemId,
  type ModelSelection,
} from "@t3tools/contracts";
import { it as effectIt } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { claudeUserInputQuestions } from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import { REQUEST_KINDS } from "../needs/derive.ts";
import {
  RUN_RECORD_FIELDS,
  byThread,
  latestHandSettles,
  pullRequestOf,
  runRecordsFilter,
  runRecordsOf,
  settledByHandAt,
} from "./needs.ts";
import {
  HOUR,
  MINUTE,
  NOW,
  at,
  pendingRequest,
  runId,
  shellFixture,
  threadId,
} from "./needs.fixture.ts";

const decodeQuestion = Schema.decodeUnknownSync(OrchestrationV2UserInputQuestion);

describe("upstream's thread shell, as the needs list reads it", () => {
  it("has a card for every kind of runtime request", () => {
    const upstream = OrchestrationV2RuntimeRequest.fields.kind.members.flatMap((member) => [
      ...member.literals,
    ]);
    expect(new Set(upstream)).toEqual(new Set(Object.keys(REQUEST_KINDS)));
  });

  it("knows every run status: the active five keep a plan back, the rest have ended", () => {
    expect(OrchestrationV2RunStatus.literals).toEqual([
      "preparing",
      "queued",
      "starting",
      "running",
      "waiting",
      "completed",
      "interrupted",
      "failed",
      "cancelled",
      "rolled_back",
    ]);
  });

  it("gives an approval the provider's reason and why full access still asks, as the cards say", () => {
    const approval = OrchestrationV2TurnItem.members.find(
      (member) => member.fields.type.literal === "approval_request",
    );
    expect(approval?.fields).toHaveProperty("reason");
    expect(approval?.fields).toHaveProperty("fullAccessOverride");
    // The web's wire names these two, each with its own words (needs/card.ts).
    expect(ProviderApprovalFullAccessOverride.literals).toEqual(["ask_rule", "provider_check"]);
  });

  it("carries a question's option preview from Claude's tool to the wire", () => {
    const [question] = claudeUserInputQuestions({
      questions: [
        {
          question: "Which layout?",
          options: [{ label: "Wide", description: "Two columns", preview: "[ a | b ]" }],
        },
      ],
    });
    expect(question?.options[0]?.preview).toBe("[ a | b ]");
    // Decoding keeps only what the schema names: a wire with no `preview` drops it here.
    const [option] = decodeQuestion({
      ...question,
      options: question?.options.map((sent) => ({ ...sent, own: 1 })),
    }).options;
    expect(option).toEqual({ label: "Wide", description: "Two columns", preview: "[ a | b ]" });
  });

  it("still names a usage limit as its own failure class", () => {
    expect(OrchestrationV2ProviderFailureClass.literals).toContain("usage_limit");
  });

  it("is what the fixtures build: a shell asking, limited, snoozed and planning", () => {
    const shells = [
      shellFixture(),
      shellFixture({ pendingRuntimeRequest: pendingRequest("user_input", { blocking: false }) }),
      shellFixture({
        status: "failed",
        lastErrorClass: "usage_limit",
        usageLimitResetAt: DateTime.formatIso(at(HOUR)),
        limitRecovery: {
          runId: runId("run-1"),
          resetAt: DateTime.formatIso(at(HOUR)),
          autoResume: true,
        },
      }),
      shellFixture({ snoozedUntil: at(HOUR), snoozedAt: at(-HOUR), lastVisitedAt: at(-HOUR) }),
      shellFixture({ hasActionableProposedPlan: true, interactionMode: "plan" }),
    ];
    for (const shell of shells) Schema.asserts(OrchestrationV2ThreadShell, shell);
  });
});

describe("upstream's settle, as the needs list reads it", () => {
  const settled = (commandId: string | null): OrchestrationV2StoredEvent => ({
    sequence: 7,
    commandId: commandId === null ? null : CommandId.make(commandId),
    event: {
      id: EventId.make("event-settled"),
      type: "thread.settled",
      threadId: threadId("otter"),
      occurredAt: at(MINUTE),
      payload: {
        ...shellFixture({ id: "otter" }),
        lastVisitedAt: null,
        settledOverride: "settled",
        settledAt: at(0),
      },
    },
  });

  it("tells the person's settle, from any client, from upstream's own", () => {
    Schema.asserts(OrchestrationV2StoredEvent, settled(null));
    expect(settledByHandAt(settled("5f0c9b8e-2d4a-4c1e-9a7b-3e6f1d2c8b90"))).toBe(NOW);
    expect(settledByHandAt(settled("server:auto-settle:otter:5f0c9b8e"))).toBeNull();
    expect(settledByHandAt(settled("server:settle-after-run:run-1"))).toBeNull();
    expect(settledByHandAt(settled(null))).toBeNull();
  });

  it("keeps a settle by hand through the batch's later changes to its thread", () => {
    const otter = threadId("otter");
    expect(
      byThread([
        { threadId: otter, lively: true },
        { threadId: otter, lively: false, settledByHandAt: NOW },
        { threadId: otter, lively: false },
      ]),
    ).toEqual([{ threadId: otter, lively: true, settledByHandAt: NOW }]);
  });
});

describe("upstream's event log, as a restarted needs list reads its settles back", () => {
  const settle = (id: string, commandId: string, offset: number) => ({
    commandId: CommandId.make(commandId),
    events: [
      {
        id: EventId.make(`event-${commandId}`),
        type: "thread.settled" as const,
        threadId: threadId(id),
        occurredAt: at(offset),
        payload: {
          ...shellFixture({ id }),
          lastVisitedAt: null,
          settledOverride: "settled" as const,
          settledAt: at(offset),
        },
      },
    ],
  });

  effectIt.effect("finds each thread's latest settle, and only the person's counts", () =>
    Effect.gen(function* () {
      const store = yield* OrchestrationEventStore.OrchestrationEventStore;
      yield* store.appendAgentEvents(settle("otter", "client-1", 0));
      yield* store.appendAgentEvents(settle("otter", "client-2", MINUTE));
      yield* store.appendAgentEvents(settle("pip", "client-3", 0));
      yield* store.appendAgentEvents(settle("pip", "server:auto-settle:pip:1", MINUTE));
      const read = yield* latestHandSettles(store, [
        threadId("otter"),
        threadId("pip"),
        threadId("gone"),
      ]);
      expect(read).toEqual([{ threadId: "otter", at: NOW + MINUTE }]);
    }).pipe(
      Effect.provide(
        OrchestrationEventStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)),
      ),
    ),
  );
});

describe("upstream's pull request link, as a Cell's brief reads it", () => {
  const link = (number: number, linkedAt: string, checksState: "passing" | "failing") => ({
    host: "github.com",
    repository: "example/harbor",
    number,
    url: `https://github.com/example/harbor/pull/${number}`,
    source: "agent" as const,
    linkedAt,
    snapshot: {
      state: "open" as const,
      title: "Header tokens",
      headBranch: "header-tokens",
      baseBranch: "main",
      isDraft: false,
      updatedAt: null,
      syncedAt: "2026-10-21T11:30:00.000Z",
      checksState,
      mergeability: "conflicting" as const,
    },
    stack: null,
  });

  it("is the one the chat is linked to, else the latest linked, with its checks", () => {
    const shell = shellFixture({
      pullRequests: [
        link(12, "2026-10-21T10:00:00.000Z", "failing"),
        link(9, "2026-10-21T11:00:00.000Z", "passing"),
      ],
    });
    Schema.asserts(OrchestrationV2ThreadShell, shell);
    expect(pullRequestOf(shell)).toMatchObject({ number: 9, checks: "passing", conflicts: true });
    expect(
      pullRequestOf({
        ...shell,
        linkedPullRequest: {
          projectId: shell.projectId,
          repository: "example/harbor",
          number: 12,
          url: "https://github.com/example/harbor/pull/12",
        },
      }),
    ).toMatchObject({ number: 12, state: "open", checks: "failing" });
    expect(pullRequestOf(shellFixture())).toBeNull();
  });
});

describe("upstream's projection, as a run's brief reads it in one read", () => {
  const otter = threadId("otter");
  const nodeId = NodeId.make("node:otter");
  const modelSelection = {
    instanceId: ProviderInstanceId.make("claudeAgent"),
    model: "claude-opus-5-5",
  } as ModelSelection;

  const seed = Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    yield* store.apply({
      id: EventId.make("event:thread"),
      type: "thread.created",
      threadId: otter,
      occurredAt: at(0),
      payload: {
        createdBy: "user",
        creationSource: "web",
        id: otter,
        projectId: ProjectId.make("project"),
        title: "Otter",
        providerInstanceId: modelSelection.instanceId,
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        activeProviderThreadId: null,
        lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: otter },
        forkedFrom: null,
        createdAt: at(0),
        updatedAt: at(0),
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
      text: string,
      minutes: number,
      wake = false,
    ) =>
      store.apply({
        id: EventId.make(`event:${id}`),
        type: "message.updated",
        threadId: otter,
        occurredAt: at(minutes * MINUTE),
        payload: {
          createdBy: wake ? "agent" : "user",
          creationSource: wake ? "server" : "web",
          ...(wake
            ? {
                notification: {
                  source: { kind: "system" as const },
                  outcome: "failed" as const,
                  summary: "Checks failed",
                },
              }
            : {}),
          id: MessageId.make(id),
          threadId: otter,
          runId: null,
          nodeId: null,
          role,
          text,
          attachments: [],
          streaming: false,
          createdAt: at(minutes * MINUTE),
          updatedAt: at(minutes * MINUTE),
        },
      });
    // Applied out of order: the brief reads them oldest first.
    yield* message("wake", "user", "The checks on #12 failed.", 9, true);
    yield* message("ask", "user", "Move the header tokens into the theme file.", 1);
    yield* message("reply", "assistant", "Moved them.", 8);
    const command = (
      id: string,
      run: string,
      ordinal: number,
      input: string,
      status: "completed" | "failed",
    ) =>
      store.apply({
        id: EventId.make(`event:${id}`),
        type: "turn-item.updated",
        threadId: otter,
        occurredAt: at(2 * MINUTE),
        payload: {
          id: TurnItemId.make(id),
          threadId: otter,
          runId: runId(run),
          nodeId,
          providerThreadId: null,
          providerTurnId: null,
          nativeItemRef: null,
          parentItemId: null,
          ordinal,
          status,
          title: null,
          startedAt: at(2 * MINUTE),
          completedAt: at(3 * MINUTE),
          updatedAt: at(3 * MINUTE),
          type: "command_execution",
          input,
        },
      });
    // Applied out of order too: a check stands on its last run, so the order is the run's.
    yield* command("item:lint", "run-2", 3, "pnpm lint", "completed");
    yield* command("item:test", "run-2", 2, "pnpm test", "failed");
    yield* command("item:before", "run-1", 1, "pnpm test", "completed");
    const checkpoint = (id: string, run: string, ordinal: number, additions: number) =>
      store.apply({
        id: EventId.make(`event:${id}`),
        type: "checkpoint.captured",
        threadId: otter,
        occurredAt: at(8 * MINUTE),
        payload: {
          id: CheckpointId.make(id),
          threadId: otter,
          scopeId: CheckpointScopeId.make("scope:otter"),
          runId: runId(run),
          nodeId,
          parentCheckpointId: null,
          ordinalWithinScope: ordinal,
          appRunOrdinal: ordinal,
          ref: CheckpointRef.make(`refs/t3/${id}`),
          status: "ready",
          files: [{ path: "theme.css", kind: "modified", additions, deletions: 1 }],
          capturedAt: at(8 * MINUTE),
        },
      });
    yield* checkpoint("checkpoint:1", "run-1", 1, 40);
    yield* checkpoint("checkpoint:2", "run-2", 2, 7);
  });

  effectIt.effect("gives who told the Cell what, what that run ran and what it changed", () =>
    Effect.gen(function* () {
      yield* seed;
      const store = yield* ProjectionStore.ProjectionStoreV2;
      const read = yield* store.getThreadRecords(
        otter,
        RUN_RECORD_FIELDS,
        runRecordsFilter("run-2"),
      );
      expect(runRecordsOf(read, "run-2")).toEqual({
        told: [
          { text: "Move the header tokens into the theme file.", news: false },
          { text: "The checks on #12 failed.", news: true },
        ],
        ran: [
          { command: "pnpm test", failed: true },
          { command: "pnpm lint", failed: false },
        ],
        files: [{ path: "theme.css", kind: "modified", additions: 7, deletions: 1 }],
      });
    }).pipe(
      Effect.provide(ProjectionStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory))),
    ),
  );
});
