/**
 * What Aski's list takes from upstream: the active threads' shells, the
 * events that change them, and the pending request or plan behind a need
 * (stemcells/tasks/aski-room.md, decision 1). Read the same way upstream's
 * own shell stream and its MCP request tools read them.
 */
import type {
  OrchestrationV2DomainEvent,
  OrchestrationV2ThreadShell,
  OrchestrationV2TurnItem,
  ProviderApprovalFullAccessOverride,
  ProviderApprovalOption,
  RunId,
  RuntimeRequestId,
  ThreadId,
} from "@t3tools/contracts";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/sql/SqlClient";

import { loadShellSnapshotParts } from "../../orchestration-v2/ShellStream.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import * as ServerSettings from "../../serverSettings.ts";

export type Shell = OrchestrationV2ThreadShell;
export type ShellThreadId = ThreadId;
export type ApprovalOption = ProviderApprovalOption;
/** What a pending runtime request asks for: a command, a file, a question, a sign-in… */
export type RequestKind = NonNullable<Shell["pendingRuntimeRequest"]>["kind"];
export type FailureClass = NonNullable<Shell["lastErrorClass"]>;

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
  /** Settings' "Auto-resume limited threads": a limit's Cell carries on at the reset. */
  readonly autoResume: Effect.Effect<boolean>;
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
        project: (stored) =>
          "aggregateKind" in stored
            ? { sequence: stored.sequence, changed: null }
            : {
                sequence: stored.sequence,
                changed: {
                  threadId: stored.event.threadId,
                  lively: LIVELY.has(stored.event.type),
                },
              },
      })
      .pipe(
        Stream.map((event) => event.changed),
        Stream.filter((changed): changed is Changed => changed !== null),
        Stream.groupedWithin(512, CHANGE_BEAT),
        Stream.map((batch) => {
          const byThread = new Map<ThreadId, boolean>();
          for (const { threadId, lively } of batch) {
            byThread.set(threadId, lively || byThread.get(threadId) === true);
          }
          return [...byThread].map(([threadId, lively]) => ({ threadId, lively }));
        }),
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

  return {
    ready,
    snapshot,
    changedThreads,
    shell,
    request,
    plan,
    reply,
    inFlight,
    autoResume: settings.getSettings.pipe(
      Effect.map((current) => current.autoResumeLimitedThreads),
      Effect.orElseSucceed(() => false),
    ),
  } satisfies NeedsSource;
});
