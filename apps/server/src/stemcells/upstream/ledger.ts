/**
 * What the ledger takes from upstream: one chat's records as its projection stores them (the
 * thread, its runs with the reply that ended each, the requests each run made and its merged
 * pull requests), the events that can make a fact, and where our own SQLite file lives. Read
 * only: nothing here writes to upstream's database, and no title or path is read.
 */
import type { OrchestrationV2DomainEvent } from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import { deriveProviderInstanceConfigMap } from "../../provider/ProviderInstanceRegistryHydration.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import * as ServerSettings from "../../serverSettings.ts";
import { ASKI_INSTANCE_ID } from "../needs/derive.ts";

/** A request a run made of the person. */
export interface LedgerRequest {
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  /** It held the run until answered: upstream's own test, a capability that isn't `message`. */
  readonly blocking: boolean;
}

export interface LedgerRun {
  readonly runId: string;
  readonly status: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  /** A completed run's last reply with words in it, where the Cell said where it stands. */
  readonly reply: string | null;
  readonly requests: ReadonlyArray<LedgerRequest>;
}

/** A pull request of the chat that merged. */
export interface LedgerMerge {
  /** `host/repository#number`: the pull request, apart from any other on any forge. */
  readonly id: string;
  readonly number: number;
  /** When its forge says it merged, as the forge wrote it; null when it didn't say. */
  readonly mergedAt: string | null;
  /** When upstream last read it. */
  readonly syncedAt: string;
}

/** One Cell's chat, deleted ones too: not Aski's chat, a subagent's thread or a side chat. */
export interface LedgerThread {
  readonly threadId: string;
  readonly projectId: string;
  /** Its provider's driver, or its instance's id when the instance is no longer configured. */
  readonly driver: string | null;
  readonly createdAt: string;
  /** When it was settled, while it is. */
  readonly settledAt: string | null;
  readonly merged: ReadonlyArray<LedgerMerge>;
  /** In the order they were asked for. */
  readonly runs: ReadonlyArray<LedgerRun>;
}

/** What changed after a sequence: the chats an event may have made a fact of. */
export interface LedgerChange {
  /** The last event read, whether or not it could make a fact. */
  readonly sequence: number;
  readonly threadIds: ReadonlyArray<string>;
}

export interface LedgerSource {
  /** Done once the server takes commands; its HTTP routes wait for the same. */
  readonly ready: Effect.Effect<void>;
  readonly environmentId: string;
  /** Our own SQLite file, open while the scope is. */
  readonly open: Effect.Effect<SqlClient.SqlClient, SqlError | PlatformError, Scope.Scope>;
  /** The latest event's sequence, and the one events are pruned through. */
  readonly sequences: Effect.Effect<{ readonly latest: number; readonly prunedThrough: number }>;
  /** The chats whose events after `afterSequence` could make a fact, a beat at a time. */
  readonly changes: (afterSequence: number) => Stream.Stream<LedgerChange>;
  /** These chats' records now; one that is gone, or isn't a Cell's, is left out. */
  readonly threads: (
    threadIds: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<LedgerThread>>;
  /** The ids of up to `limit` chats after `after`, in id order: every chat, a page at a time. */
  readonly threadIdsAfter: (after: string, limit: number) => Effect.Effect<ReadonlyArray<string>>;
}

/**
 * Whether an event can make a fact: a chat made, a run landed, a chat settled, a pull request's
 * state read. Cells stream thousands of other events an hour, and none of those is read for.
 */
export function makesFact(event: OrchestrationV2DomainEvent): boolean {
  switch (event.type) {
    case "thread.created":
    case "thread.settled":
    case "thread.pull-request-synced":
    case "thread.pull-request-link-updated":
      return true;
    case "run.created":
    case "run.updated":
      return event.payload.status === "completed";
    default:
      return false;
  }
}

/**
 * The chats' records, on SQLite's reader as upstream's long reads are: a cold read of a long
 * chat's replies would hold the server's event loop on its own connection.
 */
export const readLedgerThreads = Effect.fn("StemcellsLedger.readThreads")(function* (
  threadIds: ReadonlyArray<string>,
  /** Each provider instance's driver, by the instance's id. */
  drivers: ReadonlyMap<string, string>,
) {
  if (threadIds.length === 0) return [];
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* sql<{
    readonly threadId: string;
    readonly projectId: string;
    readonly instanceId: string | null;
    readonly createdAt: string;
    readonly settledAt: string | null;
  }>`
    SELECT
      thread_id AS "threadId",
      project_id AS "projectId",
      provider_instance_id AS "instanceId",
      created_at AS "createdAt",
      CASE WHEN json_extract(payload_json, '$.settledOverride') = 'settled'
        THEN json_extract(payload_json, '$.settledAt')
      END AS "settledAt"
    FROM orchestration_v2_projection_threads
    WHERE thread_id IN ${sql.in(threadIds)}
      AND coalesce(json_extract(payload_json, '$.lineage.relationshipToParent'), '') <> 'subagent'
      AND json_extract(payload_json, '$.lineage.sideChat') IS NOT 1
      AND coalesce(provider_instance_id, '') <> ${ASKI_INSTANCE_ID}
    ORDER BY thread_id
  `.pipe(NodeSqliteClient.readOnly);
  if (threads.length === 0) return [];
  const cells = threads.map((thread) => thread.threadId);
  const merged = yield* sql<LedgerMerge & { readonly threadId: string }>`
    SELECT
      thread.thread_id AS "threadId",
      json_extract(link.value, '$.host') || '/' || json_extract(link.value, '$.repository')
        || '#' || json_extract(link.value, '$.number') AS id,
      json_extract(link.value, '$.number') AS number,
      json_extract(link.value, '$.snapshot.mergedAt') AS "mergedAt",
      json_extract(link.value, '$.snapshot.syncedAt') AS "syncedAt"
    FROM orchestration_v2_projection_threads AS thread,
      json_each(thread.payload_json, '$.pullRequests') AS link
    WHERE thread.thread_id IN ${sql.in(cells)}
      AND json_extract(link.value, '$.snapshot.state') = 'merged'
      AND json_extract(link.value, '$.source') <> 'stack-dismissed'
  `.pipe(NodeSqliteClient.readOnly);
  const runs = yield* sql<Omit<LedgerRun, "requests"> & { readonly threadId: string }>`
    SELECT
      run.thread_id AS "threadId",
      run.run_id AS "runId",
      run.status AS status,
      json_extract(run.payload_json, '$.startedAt') AS "startedAt",
      run.completed_at AS "completedAt",
      CASE WHEN run.status = 'completed' THEN (
        SELECT json_extract(message.payload_json, '$.text')
        FROM orchestration_v2_projection_messages AS message
        WHERE message.run_id = run.run_id
          AND message.role = 'assistant'
          AND trim(json_extract(message.payload_json, '$.text')) <> ''
        ORDER BY message.created_at DESC, message.message_id DESC
        LIMIT 1
      ) END AS reply
    FROM orchestration_v2_projection_runs AS run
    WHERE run.thread_id IN ${sql.in(cells)}
    ORDER BY run.thread_id, run.ordinal
  `.pipe(NodeSqliteClient.readOnly);
  const requests = yield* sql<{
    readonly runId: string;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
    readonly capability: string | null;
  }>`
    SELECT
      node.run_id AS "runId",
      request.created_at AS "createdAt",
      request.resolved_at AS "resolvedAt",
      json_extract(request.payload_json, '$.responseCapability.type') AS capability
    FROM orchestration_v2_projection_runtime_requests AS request
    JOIN orchestration_v2_projection_nodes AS node ON node.node_id = request.node_id
    WHERE request.thread_id IN ${sql.in(cells)} AND node.run_id IS NOT NULL
    ORDER BY request.created_at
  `.pipe(NodeSqliteClient.readOnly);

  const requestsOf = new Map<string, LedgerRequest[]>();
  for (const { runId, capability, ...request } of requests) {
    const held = requestsOf.get(runId) ?? [];
    held.push({ ...request, blocking: capability !== "message" });
    requestsOf.set(runId, held);
  }
  return threads.map(({ instanceId, ...thread }): LedgerThread => ({
    ...thread,
    driver: instanceId === null ? null : (drivers.get(instanceId) ?? instanceId),
    merged: merged.flatMap(({ threadId, ...merge }) =>
      threadId === thread.threadId ? [merge] : [],
    ),
    runs: runs.flatMap(({ threadId, ...run }) =>
      threadId === thread.threadId ? [{ ...run, requests: requestsOf.get(run.runId) ?? [] }] : [],
    ),
  }));
});

/** A page of every chat's id, in id order, on SQLite's reader. */
export const readThreadIdsAfter = Effect.fn("StemcellsLedger.readThreadIdsAfter")(function* (
  after: string,
  limit: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ readonly threadId: string }>`
    SELECT thread_id AS "threadId"
    FROM orchestration_v2_projection_threads
    WHERE thread_id > ${after}
    ORDER BY thread_id
    LIMIT ${limit}
  `.pipe(NodeSqliteClient.readOnly);
  return rows.map((row) => row.threadId);
});

/**
 * A SQLite file of our own, open while the scope is. On its one connection: the ledger's
 * writes are a few rows and its reads a page, so it takes no worker of its own.
 */
export const openLedgerFile = Effect.fn("StemcellsLedger.openFile")(function* (filename: string) {
  const context = yield* Layer.build(NodeSqliteClient.layer({ filename }));
  return Context.get(context, SqlClient.SqlClient);
});

/** Events arrive in bursts while a Cell streams; one read per chat per beat. */
const CHANGE_BEAT = Duration.millis(250);

export const makeLedgerSource = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const events = yield* OrchestrationEventStore.OrchestrationEventStore;
  const startup = yield* ServerRuntimeStartup.ServerRuntimeStartup;
  const settings = yield* ServerSettings.ServerSettingsService;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const environmentId: string = yield* environment.getEnvironmentId;
  const folder = path.join(config.stateDir, "stemcells");

  const drivers = settings.getSettings.pipe(
    Effect.map(
      (current) =>
        new Map<string, string>(
          Object.entries(deriveProviderInstanceConfigMap(current)).map(([id, instance]) => [
            id,
            instance.driver,
          ]),
        ),
    ),
    Effect.orElseSucceed(() => new Map<string, string>()),
  );

  return {
    ready: startup.awaitCommandReady.pipe(Effect.orDie),
    environmentId,
    open: fs
      .makeDirectory(folder, { recursive: true })
      .pipe(Effect.andThen(openLedgerFile(path.join(folder, "ledger.sqlite")))),
    sequences: Effect.all({
      latest: events.latestApplicationSequence,
      prunedThrough: events.prunedThroughSequence,
    }).pipe(Effect.orDie),
    changes: (afterSequence) =>
      events
        .streamProjectedApplicationEvents({
          afterSequence,
          project: (stored) => ({
            sequence: stored.sequence,
            threadId:
              "aggregateKind" in stored || !makesFact(stored.event) ? null : stored.event.threadId,
          }),
        })
        .pipe(
          Stream.groupedWithin(512, CHANGE_BEAT),
          Stream.filter((batch) => batch.length > 0),
          Stream.map((batch): LedgerChange => ({
            sequence: batch.at(-1)!.sequence,
            threadIds: [
              ...new Set(batch.flatMap((each) => (each.threadId === null ? [] : [each.threadId]))),
            ],
          })),
          Stream.orDie,
        ),
    threads: (threadIds) =>
      Effect.flatMap(drivers, (known) => readLedgerThreads(threadIds, known)).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ),
    threadIdsAfter: (after, limit) =>
      readThreadIdsAfter(after, limit).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ),
  } satisfies LedgerSource;
});
