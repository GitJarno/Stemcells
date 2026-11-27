/**
 * What recall takes from upstream: a chat's shell, the messages in the person's seat with
 * their times, its latest run's reply and records, the events after which a card can differ,
 * the projects with their repositories, and where our own SQLite file lives. Read only, and
 * through the same reads the needs list makes (`needs.ts`).
 */
import {
  type OrchestrationV2DomainEvent,
  repositoryGroupingKeyOf,
  type RunId,
  type ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { PlatformError } from "effect/PlatformError";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

import * as ServerConfig from "../../config.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import type { RunRead } from "../recall/card.ts";
import { openLedgerFile, readThreadIdsAfter } from "./ledger.ts";
import { RUN_RECORD_FIELDS, runRecordsFilter, runRecordsOf, type Shell } from "./needs.ts";

/** A project as recall reads it: its title to hear and show, its repository to scope by. */
export interface RecallProject {
  readonly id: string;
  readonly title: string;
  /** Upstream's own grouping of projects by remote; null without one. */
  readonly repo: string | null;
}

export interface RecallSource {
  /** Done once the server takes commands; its HTTP routes wait for the same. */
  readonly ready: Effect.Effect<void>;
  readonly environmentId: string;
  /** Our own SQLite file, open while the scope is. */
  readonly open: Effect.Effect<SqlClient.SqlClient, SqlError | PlatformError, Scope.Scope>;
  /** The latest event's sequence: the live read starts after it. */
  readonly latestSequence: Effect.Effect<number>;
  /** The chats whose card an event after `afterSequence` can have changed, a beat at a time. */
  readonly changes: (afterSequence: number) => Stream.Stream<ReadonlyArray<string>>;
  /** The ids of up to `limit` chats after `after`, in id order: every chat, a page at a time. */
  readonly threadIdsAfter: (after: string, limit: number) => Effect.Effect<ReadonlyArray<string>>;
  /** One chat's shell now; null once it is gone. */
  readonly shell: (threadId: string) => Effect.Effect<Shell | null>;
  /** What a card takes beyond the shell, for the chat's latest run. */
  readonly run: (threadId: string, runId: string) => Effect.Effect<RunRead>;
  /** Every project; empty when they can't be read. */
  readonly projects: Effect.Effect<ReadonlyArray<RecallProject>>;
}

/**
 * Whether a card can differ after the event: a run asked for or ended, a Cell put to sleep or
 * woken, renamed, deleted, or its pull request read again. Cells stream thousands of other
 * events an hour, and none of those is read for.
 */
export function changesCard(event: OrchestrationV2DomainEvent): boolean {
  switch (event.type) {
    case "thread.archived":
    case "thread.unarchived":
    case "thread.deleted":
    case "thread.settled":
    case "thread.unsettled":
    case "thread.snoozed":
    case "thread.unsnoozed":
    case "thread.metadata-updated":
    case "thread.pull-request-synced":
    case "thread.pull-request-link-updated":
    case "run.created":
      return true;
    case "run.updated":
      return event.payload.completedAt != null;
    default:
      return false;
  }
}

/** Events arrive in bursts; one read per chat per beat. */
const CHANGE_BEAT = Duration.millis(500);

export const makeRecallSource = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const events = yield* OrchestrationEventStore.OrchestrationEventStore;
  const startup = yield* ServerRuntimeStartup.ServerRuntimeStartup;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const projects = yield* ProjectService.ProjectService;
  const config = yield* ServerConfig.ServerConfig;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const environmentId: string = yield* environment.getEnvironmentId;
  const folder = path.join(config.stateDir, "stemcells");

  const reply = (threadId: ThreadId, runId: RunId) =>
    threads
      .getThreadRecords(threadId, ["messages"], {
        messageRoles: ["assistant"],
        messageRunIds: [runId],
      })
      .pipe(
        Effect.map(
          (records) =>
            records.messages.findLast((message) => message.text.trim() !== "")?.text ?? null,
        ),
      );

  const seat = (threadId: ThreadId, runId: RunId) =>
    threads.getThreadRecords(threadId, RUN_RECORD_FIELDS, runRecordsFilter(runId)).pipe(
      Effect.map((read) => ({
        records: runRecordsOf(read, runId),
        messages: read.messages
          .filter((message) => message.role === "user" && !message.streaming)
          .map((message) => ({
            text: message.text,
            at: DateTime.toEpochMillis(message.createdAt),
            news:
              message.notification !== undefined ||
              message.scheduledTaskId !== undefined ||
              message.idleCompaction !== undefined ||
              message.delegatedCompletion !== undefined ||
              message.workflowScript === true,
            fromCell: message.senderThreadId !== undefined || message.linkedSender !== undefined,
          }))
          .sort((a, b) => a.at - b.at),
      })),
    );

  return {
    ready: startup.awaitCommandReady.pipe(Effect.orDie),
    environmentId,
    open: fs
      .makeDirectory(folder, { recursive: true })
      .pipe(Effect.andThen(openLedgerFile(path.join(folder, "recall.sqlite")))),
    latestSequence: events.latestApplicationSequence.pipe(Effect.orDie),
    changes: (afterSequence) =>
      events
        .streamProjectedApplicationEvents({
          afterSequence,
          project: (stored) => ({
            sequence: stored.sequence,
            threadId:
              "aggregateKind" in stored || !changesCard(stored.event)
                ? null
                : (stored.event.threadId as string),
          }),
        })
        .pipe(
          Stream.groupedWithin(512, CHANGE_BEAT),
          Stream.map((batch) => [
            ...new Set(batch.flatMap((each) => (each.threadId === null ? [] : [each.threadId]))),
          ]),
          Stream.filter((threadIds) => threadIds.length > 0),
          Stream.orDie,
        ),
    threadIdsAfter: (after, limit) =>
      readThreadIdsAfter(after, limit).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ),
    shell: (threadId) => threads.getThreadShell(threadId as ThreadId).pipe(Effect.orDie),
    run: (threadId, runId) =>
      Effect.all(
        {
          seat: seat(threadId as ThreadId, runId as RunId),
          reply: reply(threadId as ThreadId, runId as RunId),
        },
        { concurrency: 2 },
      ).pipe(
        Effect.map(({ seat, reply }): RunRead => ({ ...seat, reply })),
        Effect.orDie,
      ),
    projects: projects.listShells().pipe(
      Effect.map((shells) =>
        shells.map((project): RecallProject => ({
          id: project.id,
          title: project.title,
          repo: project.repositoryIdentity
            ? repositoryGroupingKeyOf(project.repositoryIdentity)
            : null,
        })),
      ),
      Effect.catchCause((cause) =>
        Effect.logWarning("Recall couldn't read the projects", cause).pipe(Effect.as([])),
      ),
    ),
  } satisfies RecallSource;
});
