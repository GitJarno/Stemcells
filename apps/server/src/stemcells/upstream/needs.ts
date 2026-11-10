/**
 * What Aski's list takes from upstream: the active threads' shells, the
 * events that change them, and the pending request or plan behind a need
 * (stemcells/tasks/aski-room.md, decision 1). Read the same way upstream's
 * own shell stream and its MCP request tools read them.
 */
import type {
  OrchestrationV2Checkpoint,
  OrchestrationV2ConversationMessage,
  OrchestrationV2DomainEvent,
  OrchestrationV2StoredEvent,
  OrchestrationV2ThreadShell,
  OrchestrationV2TurnItem,
  ProviderApprovalFullAccessOverride,
  ProviderApprovalOption,
  RunId,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";

import { loadShellSnapshotParts } from "../../orchestration-v2/ShellStream.ts";
import { projectTurnItemForWire } from "../../orchestration-v2/WireProjection.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import { isSnoozed as threadIsSnoozed } from "../../orchestration-v2/ThreadSettlementService.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import * as ServerSettings from "../../serverSettings.ts";
import type { PullRequestFact, RunRecords } from "../needs/evidence.ts";

export type Shell = OrchestrationV2ThreadShell;
export type ShellThreadId = ThreadId;
export type ApprovalOption = ProviderApprovalOption;
/** What a pending runtime request asks for: a command, a file, a question, a sign-in… */
export type RequestKind = NonNullable<Shell["pendingRuntimeRequest"]>["kind"];
export type FailureClass = NonNullable<Shell["lastErrorClass"]>;

/**
 * T3's own snooze rule, the one its sidebar shows: a snooze holds until its time unless an
 * approval, a question asked after it, a guest's message, or a later failure wakes it.
 */
export const isSnoozed = (shell: Shell, now: number): boolean => threadIsSnoozed(shell, now);

/** A question a Cell asked through its provider's own question tool. */
export interface AskedQuestion {
  readonly id: string;
  readonly header: string;
  readonly question: string;
  /** `value`, when the Cell gave one, is what its answer carries in place of the label. */
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    readonly value: string | null;
    /** What the option looks like, to see before choosing it: markdown, or a mockup as written. */
    readonly preview: string | null;
  }>;
  readonly multiSelect: boolean;
  readonly allowCustomAnswer: boolean;
}

/** Why a request reached the person although the thread runs with full access. */
export type FullAccessOverride = ProviderApprovalFullAccessOverride;

/** The pending request a shell's `pendingRuntimeRequest` summarises, in full. */
export interface RequestDetail {
  readonly id: string;
  /** The command or file the Cell wants, as its provider worded the request. */
  readonly prompt: string | null;
  readonly appName: string | null;
  /** The provider's own words for why it asks, when it gives them. */
  readonly reason: string | null;
  /** Why it asks although the thread runs with full access. */
  readonly fullAccessOverride: FullAccessOverride | null;
  readonly options: ReadonlyArray<ApprovalOption>;
  readonly questions: ReadonlyArray<AskedQuestion>;
  /** "message": the answer goes as a message, and the question can be dismissed. */
  readonly responseMode: "message" | null;
  /** How the provider takes the answer; "not_resumable" can't be answered any more. */
  readonly capability: "live" | "message" | "not_resumable";
}

/** The plan a shell's `hasActionableProposedPlan` points at. */
export interface PlanDetail {
  readonly id: string;
  readonly markdown: string;
}

/** What a quiet run is in the middle of: a tool call, or nothing (the model itself). */
export interface InFlight {
  readonly tool: {
    readonly title: string | null;
    /** The command, for a shell call: shown whole. */
    readonly command: string | null;
  } | null;
}

/**
 * A thread that changed in a batch. `lively` when the Cell itself did something: wrote,
 * asked, planned, or moved a run or a tool call along. The person's hand (a visit, a snooze,
 * a rename) isn't the Cell's life, nor is a provider's beat: Codex polls a running command
 * about once a minute and reports the tokens, with nothing new to show.
 */
export interface Changed {
  readonly threadId: ThreadId;
  readonly lively: boolean;
  /** When the person settled it by hand, on any device (`settledByHandAt`). */
  readonly settledByHandAt?: number;
}

/** The events of a Cell's own work. */
const LIVELY: ReadonlySet<OrchestrationV2DomainEvent["type"]> = new Set([
  "run.created",
  "run.updated",
  "node.updated",
  "subagent.updated",
  "message.updated",
  "turn-item.updated",
  "runtime-request.updated",
  "plan.updated",
]);

export interface NeedsSource {
  /** Done once the server takes commands; its HTTP routes wait for the same. */
  readonly ready: Effect.Effect<void>;
  /** The active threads' shells, and the event sequence they were read at. */
  readonly snapshot: Effect.Effect<{
    readonly shells: ReadonlyArray<Shell>;
    readonly sequence: number;
  }>;
  /** The threads that changed after `afterSequence`, a batch at a time. */
  readonly changedThreads: (afterSequence: number) => Stream.Stream<ReadonlyArray<Changed>>;
  /**
   * The latest settle by hand of each thread, from the event log, for a restart, which forgets
   * the day's: a thread whose latest settle was upstream's own has none.
   */
  readonly handSettles: (
    threadIds: ReadonlyArray<ThreadId>,
  ) => Effect.Effect<ReadonlyArray<{ readonly threadId: ThreadId; readonly at: number }>>;
  /** One thread's shell now; null once it is gone. A failed read dies. */
  readonly shell: (threadId: ThreadId) => Effect.Effect<Shell | null>;
  /** The pending request in full; null when it was answered meanwhile or can't be read. */
  readonly request: (threadId: ThreadId, requestId: string) => Effect.Effect<RequestDetail | null>;
  /** The active proposed plan; null when there is none. */
  readonly plan: (threadId: ThreadId) => Effect.Effect<PlanDetail | null>;
  /** The Cell's last reply in a run, whole; null when it wrote none or it can't be read. */
  readonly reply: (threadId: ThreadId, runId: string) => Effect.Effect<string | null>;
  /** What a running run is in the middle of; null when it can't be read. */
  readonly inFlight: (threadId: ThreadId, runId: string) => Effect.Effect<InFlight | null>;
  /**
   * What a run left in the records: who told the Cell what, the commands it ran to their end
   * and the files it changed. Null when they can't be read.
   */
  readonly records: (threadId: ThreadId, runId: string) => Effect.Effect<RunRecords | null>;
  /** Settings' "Auto-resume limited threads": a limit's Cell carries on at the reset. */
  readonly autoResume: Effect.Effect<boolean>;
}

/**
 * When the person settled the thread by hand, in ms; null for any other event. Upstream's own
 * settles (a quiet day, a merged pull request, a Cell's run ending) send commands whose ids start
 * `server:`, and its auto-settle repair migration keys on that prefix; a client's carry its own id.
 */
export function settledByHandAt(stored: OrchestrationV2StoredEvent): number | null {
  const { commandId, event } = stored;
  if (event.type !== "thread.settled" || commandId === null || commandId.startsWith("server:")) {
    return null;
  }
  return DateTime.toEpochMillis(event.payload.settledAt ?? event.occurredAt);
}

/** A batch's changes, one per thread: lively if any was, with its latest settle by hand. */
export function byThread(batch: ReadonlyArray<Changed>): ReadonlyArray<Changed> {
  const merged = new Map<ThreadId, Changed>();
  for (const change of batch) {
    const before = merged.get(change.threadId);
    const settledByHandAt = change.settledByHandAt ?? before?.settledByHandAt;
    merged.set(change.threadId, {
      threadId: change.threadId,
      lively: change.lively || before?.lively === true,
      ...(settledByHandAt === undefined ? {} : { settledByHandAt }),
    });
  }
  return [...merged.values()];
}

/** Each thread's latest settle by hand, read back from the event log; a failed read has none. */
export const latestHandSettles = (
  events: OrchestrationEventStore.OrchestrationEventStore["Service"],
  threadIds: ReadonlyArray<ThreadId>,
) =>
  Effect.forEach(threadIds, (threadId) =>
    events.readAgentEvents({ threadId, eventType: "thread.settled" }).pipe(
      Stream.runLast,
      Effect.map((last) => {
        const at = Option.isSome(last) ? settledByHandAt(last.value) : null;
        return at === null ? [] : [{ threadId, at }];
      }),
      Effect.orElseSucceed(() => []),
    ),
  ).pipe(Effect.map((each) => each.flat()));

/**
 * The Cell's pull request as upstream last read it: the one its chat is linked to, else the
 * latest it linked. Null without one, or before upstream has read it.
 */
export function pullRequestOf(shell: Shell): PullRequestFact | null {
  const links = (shell.pullRequests ?? []).filter((link) => link.source !== "stack-dismissed");
  const number = (shell.linkedPullRequest ?? shell.branchPullRequest)?.number;
  const link =
    links.find((each) => each.number === number) ??
    [...links].sort((a, b) => a.linkedAt.localeCompare(b.linkedAt)).at(-1);
  const snapshot = link?.snapshot ?? null;
  if (link === undefined || snapshot === null) return null;
  return {
    number: link.number,
    url: link.url,
    state: snapshot.state,
    draft: snapshot.isDraft,
    checks: snapshot.checksState ?? null,
    conflicts: snapshot.mergeability === "conflicting",
  };
}

/** A command that ran to its end; one still running, or stopped, shows nothing yet. */
const RAN: ReadonlySet<OrchestrationV2TurnItem["status"]> = new Set(["completed", "failed"]);

/** Upstream's own rule for a failed command, the one its chat marks a command red by. */
function commandFailed(item: OrchestrationV2TurnItem): boolean {
  if (item.status === "failed") return true;
  const shown = projectTurnItemForWire(item);
  return shown.type === "command_execution" && shown.outputIndicatesFailure === true;
}

/** What a run's brief reads, in one read (`needs.contract.test.ts` reads the real store with it). */
export const RUN_RECORD_FIELDS = ["messages", "turnItems", "checkpoints"] as const;
export const runRecordsFilter = (runId: string) =>
  ({
    messageRoles: ["user"],
    turnItemRunIds: [runId as RunId],
    turnItemTypes: ["command_execution"],
  }) as const;

/**
 * Who told the Cell what, oldest first; the commands `runId` ran to their end; and the files
 * its checkpoint counts. A message upstream sent in the person's seat (a wake, a notification,
 * a compaction, a workflow's script) is news, never an instruction.
 */
export function runRecordsOf(
  read: {
    readonly messages: ReadonlyArray<OrchestrationV2ConversationMessage>;
    readonly turnItems: ReadonlyArray<OrchestrationV2TurnItem>;
    readonly checkpoints: ReadonlyArray<OrchestrationV2Checkpoint>;
  },
  runId: string,
): RunRecords {
  return {
    told: read.messages
      .filter((message) => message.role === "user" && !message.streaming)
      .toSorted((a, b) => DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt))
      .map((message) => ({
        text: message.text,
        news:
          message.notification !== undefined ||
          message.scheduledTaskId !== undefined ||
          message.idleCompaction !== undefined ||
          message.delegatedCompletion !== undefined ||
          message.workflowScript === true,
      })),
    // In the order they ran: a kind of check stands on its last run.
    ran: read.turnItems
      .toSorted((a, b) => a.ordinal - b.ordinal)
      .flatMap((item) =>
        item.type === "command_execution" && item.runId === runId && RAN.has(item.status)
          ? [{ command: item.input, failed: commandFailed(item) }]
          : [],
      ),
    files: read.checkpoints
      .filter((checkpoint) => checkpoint.runId === runId && checkpoint.status === "ready")
      .flatMap((checkpoint) => checkpoint.files),
  };
}

/** Items a run is in the middle of that are the model's own words, not a tool call. */
const OWN_WORDS: ReadonlySet<OrchestrationV2TurnItem["type"]> = new Set([
  "assistant_message",
  "reasoning",
  "user_message",
]);

/** Shells and events arrive in bursts while a Cell streams; one read per thread per beat. */
const CHANGE_BEAT = Duration.millis(250);

export const makeNeedsSource = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const events = yield* OrchestrationEventStore.OrchestrationEventStore;
  const startup = yield* ServerRuntimeStartup.ServerRuntimeStartup;
  const settings = yield* ServerSettings.ServerSettingsService;

  const ready = startup.awaitCommandReady.pipe(Effect.orDie);

  const snapshot = loadShellSnapshotParts({
    sql,
    readThreads: threads.readShellSnapshot({ location: "active" }),
    listProjects: Effect.succeed([]),
    latestSequence: events.latestApplicationSequence,
  }).pipe(
    Effect.map((parts) => ({ shells: parts.threads.threads, sequence: parts.snapshotSequence })),
    Effect.orDie,
  );

  const changedThreads = (afterSequence: number) =>
    events
      .streamProjectedApplicationEvents({
        afterSequence,
        project: (stored) => {
          if ("aggregateKind" in stored) return { sequence: stored.sequence, changed: null };
          const settled = settledByHandAt(stored);
          return {
            sequence: stored.sequence,
            changed: {
              threadId: stored.event.threadId,
              lively: LIVELY.has(stored.event.type),
              ...(settled === null ? {} : { settledByHandAt: settled }),
            },
          };
        },
      })
      .pipe(
        Stream.map((event) => event.changed),
        Stream.filter((changed): changed is Changed => changed !== null),
        Stream.groupedWithin(512, CHANGE_BEAT),
        Stream.map(byThread),
        Stream.orDie,
      );

  // A failed read ends the stream: the list starts over from a snapshot
  // rather than drop a Cell it could not read.
  const shell = (threadId: ThreadId) => threads.getThreadShell(threadId).pipe(Effect.orDie);

  const request = (threadId: ThreadId, requestId: string) =>
    threads
      .getThreadRecords(threadId, ["runtimeRequests", "turnItems"], {
        turnItemTypes: ["approval_request", "user_input_request"],
      })
      .pipe(
        Effect.map((records): RequestDetail | null => {
          const pending = records.runtimeRequests.find(
            (candidate) => candidate.id === requestId && candidate.status === "pending",
          );
          if (pending === undefined) return null;
          const item = records.turnItems.findLast(
            (candidate) =>
              (candidate.type === "approval_request" || candidate.type === "user_input_request") &&
              candidate.requestId === (requestId as RuntimeRequestId),
          );
          const capability = pending.responseCapability.type;
          const message = capability === "message";
          if (item?.type === "user_input_request") {
            return {
              id: requestId,
              prompt: null,
              appName: null,
              reason: null,
              fullAccessOverride: null,
              options: [],
              questions: item.questions.map((question) => ({
                id: question.id,
                header: question.header,
                question: question.question,
                options: question.options.map((option) => ({
                  label: option.label,
                  description: option.description,
                  value: option.value ?? null,
                  preview: option.preview ?? null,
                })),
                multiSelect: question.multiSelect ?? false,
                allowCustomAnswer: question.allowCustomAnswer ?? true,
              })),
              responseMode: item.responseMode === "message" || message ? "message" : null,
              capability,
            };
          }
          return {
            id: requestId,
            prompt: item?.type === "approval_request" ? (item.prompt ?? null) : null,
            appName: item?.type === "approval_request" ? (item.appName ?? null) : null,
            reason: item?.type === "approval_request" ? (item.reason ?? null) : null,
            fullAccessOverride:
              item?.type === "approval_request" ? (item.fullAccessOverride ?? null) : null,
            options: item?.type === "approval_request" ? (item.options ?? []) : [],
            questions: [],
            responseMode: message ? "message" : null,
            capability,
          };
        }),
        Effect.catchCause(() => Effect.succeed(null)),
      );

  const plan = (threadId: ThreadId) =>
    threads.getThreadRecords(threadId, ["plans"]).pipe(
      Effect.map((records): PlanDetail | null => {
        const active = records.plans.findLast(
          (candidate) => candidate.kind === "proposed_plan" && candidate.status === "active",
        );
        return active?.kind === "proposed_plan"
          ? { id: active.id, markdown: active.markdown }
          : null;
      }),
      Effect.catchCause(() => Effect.succeed(null)),
    );

  const reply = (threadId: ThreadId, runId: string) =>
    threads
      .getThreadRecords(threadId, ["messages"], {
        messageRoles: ["assistant"],
        messageRunIds: [runId as RunId],
      })
      .pipe(
        Effect.map(
          (records) =>
            records.messages.findLast((message) => message.text.trim() !== "")?.text ?? null,
        ),
        Effect.catchCause(() => Effect.succeed(null)),
      );

  const inFlight = (threadId: ThreadId, runId: string) =>
    threads
      .getThreadRecords(threadId, ["turnItems"], {
        turnItemRunIds: [runId as RunId],
        turnItemStatuses: ["pending", "running", "waiting"],
      })
      .pipe(
        Effect.map((records): InFlight => {
          const item = records.turnItems.findLast((candidate) => !OWN_WORDS.has(candidate.type));
          return {
            tool:
              item === undefined
                ? null
                : {
                    title: item.title,
                    command: item.type === "command_execution" ? item.input : null,
                  },
          };
        }),
        Effect.catchCause(() => Effect.succeed(null)),
      );

  const records = (threadId: ThreadId, runId: string) =>
    threads.getThreadRecords(threadId, RUN_RECORD_FIELDS, runRecordsFilter(runId)).pipe(
      Effect.map((read) => runRecordsOf(read, runId)),
      Effect.catchCause(() => Effect.succeed(null)),
    );

  return {
    ready,
    snapshot,
    changedThreads,
    handSettles: (threadIds) => latestHandSettles(events, threadIds),
    shell,
    request,
    plan,
    reply,
    inFlight,
    records,
    autoResume: settings.getSettings.pipe(
      Effect.map((current) => current.autoResumeLimitedThreads),
      Effect.orElseSucceed(() => false),
    ),
  } satisfies NeedsSource;
});
