/**
 * Settings › Lineage's spend reads what upstream's projection stores: each
 * provider turn's `turnTokenUsage`, joined through its run attempt to the
 * model its run asked for. The turns here are written by upstream's own
 * projection, from the events its adapters emit. A failure after a sync means
 * the spend reads the store as it no longer is.
 */
import { assert, it } from "@effect/vitest";
import {
  EventId,
  MessageId,
  NodeId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderThreadId,
  ProviderTurnId,
  RunAttemptId,
  RunId,
  ThreadId,
  type ModelSelection,
  type TurnTokenUsage,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ProjectionStore from "../../orchestration-v2/ProjectionStore.ts";
import * as SqlitePersistence from "../../persistence/Sqlite.ts";
import { spendByThread } from "../spend/spend.ts";
import { costOf, readSpendRows, type Pricing } from "./spend.ts";

const layerTest = Layer.mergeAll(
  ProjectionStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)),
  SqlitePersistence.layerMemory,
);
const instanceId = ProviderInstanceId.make("claudeAgent");
const driver = ProviderDriverKind.make("claudeAgent");

/** A chat with one run on `modelSelection`, whose turns reported `usages`. */
const chatWithTurns = (
  name: string,
  modelSelection: ModelSelection,
  usages: ReadonlyArray<TurnTokenUsage | undefined>,
) =>
  Effect.gen(function* () {
    const store = yield* ProjectionStore.ProjectionStoreV2;
    const now = yield* DateTime.now;
    const threadId = ThreadId.make(`thread:${name}`);
    const runId = RunId.make(`run:${name}`);
    const attemptId = RunAttemptId.make(`attempt:${name}`);
    const nodeId = NodeId.make(`node:${name}`);
    const providerThreadId = ProviderThreadId.make(`provider-thread:${name}`);
    yield* store.apply({
      id: EventId.make(`event:${name}:thread`),
      type: "thread.created",
      threadId,
      occurredAt: now,
      payload: {
        createdBy: "user",
        creationSource: "web",
        id: threadId,
        projectId: ProjectId.make(`project:${name}`),
        title: name,
        providerInstanceId: instanceId,
        modelSelection,
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        activeProviderThreadId: null,
        lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
        forkedFrom: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        settledOverride: null,
        settledAt: null,
        lastVisitedAt: null,
        deletedAt: null,
      },
    });
    yield* store.apply({
      id: EventId.make(`event:${name}:run`),
      type: "run.created",
      threadId,
      occurredAt: now,
      payload: {
        id: runId,
        threadId,
        ordinal: 1,
        providerInstanceId: instanceId,
        modelSelection,
        providerThreadId,
        userMessageId: MessageId.make(`message:${name}`),
        rootNodeId: nodeId,
        activeAttemptId: attemptId,
        status: "completed",
        requestedAt: now,
        startedAt: now,
        completedAt: now,
        checkpointId: null,
        contextHandoffId: null,
      },
    });
    yield* store.apply({
      id: EventId.make(`event:${name}:attempt`),
      type: "run-attempt.created",
      threadId,
      occurredAt: now,
      payload: {
        id: attemptId,
        runId,
        attemptOrdinal: 1,
        rootNodeId: nodeId,
        providerInstanceId: instanceId,
        providerThreadId,
        providerTurnId: null,
        reason: "initial",
        status: "completed",
        startedAt: now,
        completedAt: now,
      },
    });
    for (const [index, turnTokenUsage] of usages.entries()) {
      yield* store.apply({
        id: EventId.make(`event:${name}:turn:${index}`),
        type: "provider-turn.updated",
        threadId,
        nodeId,
        driver,
        occurredAt: now,
        payload: {
          id: ProviderTurnId.make(`provider-turn:${name}:${index}`),
          providerThreadId,
          nodeId,
          runAttemptId: attemptId,
          nativeTurnRef: null,
          ordinal: index + 1,
          status: "completed",
          startedAt: now,
          completedAt: now,
          ...(turnTokenUsage === undefined ? {} : { turnTokenUsage }),
        },
      });
    }
    return threadId;
  });

const complete = (input: number, cached: number, output: number): TurnTokenUsage => ({
  usageScope: "main_agent",
  usageStatus: "complete",
  hasSubagents: false,
  inputTokens: input,
  cachedInputTokens: cached,
  cacheCreationTokens: 0,
  outputTokens: output,
});

/** $1 a million in, $0.10 cached, $10 out; fast mode doubles it. */
const rate = (scale: number) => ({
  inputCostPerToken: scale / 1_000_000,
  outputCostPerToken: (10 * scale) / 1_000_000,
  cacheReadCostPerToken: (0.1 * scale) / 1_000_000,
  cacheCreationCostPerToken: scale / 1_000_000,
});
const pricing: Pricing = {
  rates: new Map([["claude-opus-5-5", { ...rate(1), fast: rate(2), ultrafast: null }]]),
  overrides: new Map(),
  aliases: new Map(),
};

it.layer(layerTest)("Stemcells' spend, read from upstream's projection", (it) => {
  it.effect("sums each chat's turns by the model its run asked for, at its speed", () =>
    Effect.gen(function* () {
      const standard = yield* chatWithTurns("standard", { instanceId, model: "claude-opus-5-5" }, [
        complete(1_000_000, 0, 100_000),
        complete(1_000_000, 1_000_000, 0),
      ]);
      const fast = yield* chatWithTurns(
        "fast",
        { instanceId, model: "claude-opus-5-5", options: [{ id: "fastMode", value: true }] },
        [complete(1_000_000, 0, 0)],
      );
      const { since, rows } = yield* readSpendRows;
      const spend = spendByThread(rows, pricing);

      assert.isNotNull(since);
      // $1 in + $1 out, then a million cached at $0.10.
      assert.deepEqual(spend[standard], {
        tokens: 2_100_000,
        inputTokens: 2_000_000,
        cachedInputTokens: 1_000_000,
        outputTokens: 100_000,
        costUsd: 2.1,
        short: false,
      });
      assert.strictEqual(spend[fast]?.costUsd, 2);
    }),
  );

  it.effect("says the count is short when a turn gave none or ran subagents", () =>
    Effect.gen(function* () {
      const uncounted = yield* chatWithTurns(
        "uncounted",
        { instanceId, model: "claude-opus-5-5" },
        [complete(10, 0, 10), undefined],
      );
      const subagents = yield* chatWithTurns(
        "subagents",
        { instanceId, model: "claude-opus-5-5" },
        [{ ...complete(10, 0, 10), hasSubagents: true }],
      );
      const spend = spendByThread((yield* readSpendRows).rows, pricing);
      assert.strictEqual(spend[uncounted]?.tokens, 20);
      assert.isTrue(spend[uncounted]?.short);
      assert.isTrue(spend[subagents]?.short);
    }),
  );

  it.effect("leaves a model without a price unpriced, its tokens still counted", () =>
    Effect.gen(function* () {
      const unknown = yield* chatWithTurns(
        "unknown",
        { instanceId, model: "a-model-no-one-prices" },
        [complete(500, 0, 500)],
      );
      const row = (yield* readSpendRows).rows.find((candidate) => candidate.threadId === unknown);
      assert.isNull(costOf(pricing, row!));
      const spend = spendByThread([row!], pricing);
      assert.deepEqual(
        [spend[unknown]?.tokens, spend[unknown]?.costUsd, spend[unknown]?.short],
        [1000, null, true],
      );
    }),
  );
});
