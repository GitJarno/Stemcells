/**
 * What collisions take from upstream (stemcells/tasks/peers.md, decision 3): each finished
 * file edit (a `file_change` turn item every adapter records), the thread shells that say
 * whose an edit is and where it landed, a project's root and repository, and the dispatch
 * that queues the notice behind the Cell's running turn.
 */
import {
  CommandId,
  MessageId,
  type OrchestrationV2ServerCommand,
  ProjectId,
  repositoryGroupingKeyOf,
  type ThreadId,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as OrchestrationEventStore from "../../persistence/OrchestrationEventStore.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import type { Shell } from "./needs.ts";

export type { Shell };

/** A file edit a provider finished. */
export interface FinishedEdit {
  readonly threadId: ThreadId;
  readonly fileName: string;
  readonly at: number;
}

/**
 * A collision notice's id: the kind and the other Cell, so every screen can
 * show it as the notice it is, the other Cell a door to its chat
 * (`apps/web/src/stemcells/peers`), rather than as words the person typed.
 * `nonce` is fresh for every notice.
 */
export const noticeMessageId = (
  kind: "file" | "checkout",
  otherThreadId: string,
  nonce: string,
): string => `stemcells-collision:${kind}:${encodeURIComponent(otherThreadId)}:${nonce}`;

/** The notice, queued behind the Cell's running turn: sent by the app, not the person. */
export function noticeCommand(input: {
  readonly threadId: ThreadId;
  readonly kind: "file" | "checkout";
  readonly otherThreadId: string;
  readonly text: string;
  readonly nonce: string;
}): OrchestrationV2ServerCommand {
  const id = noticeMessageId(input.kind, input.otherThreadId, input.nonce);
  return {
    type: "message.dispatch",
    commandId: CommandId.make(id),
    threadId: input.threadId,
    messageId: MessageId.make(id),
    text: input.text,
    attachments: [],
    dispatchMode: { type: "queue_after_active" },
    createdBy: "agent",
    creationSource: "server",
  };
}

export interface CollisionsSource {
  /** Done once the server takes commands. */
  readonly ready: Effect.Effect<void>;
  /** The event sequence now: edits are followed from here. */
  readonly sequence: Effect.Effect<number>;
  /** Every edit finished after `afterSequence`. */
  readonly edits: (afterSequence: number) => Stream.Stream<FinishedEdit>;
  /** One thread's shell now; null once it is gone or can't be read. */
  readonly shell: (threadId: ThreadId) => Effect.Effect<Shell | null>;
  /**
   * A project's root folder and its repository's key (upstream's grouping,
   * by its remote; the project's own when it has none); null once it is
   * gone or can't be read.
   */
  readonly project: (
    projectId: string,
  ) => Effect.Effect<{ readonly root: string; readonly repo: string } | null>;
  /** A fresh random id. */
  readonly newId: Effect.Effect<string>;
  /** Sends the command; false when the orchestrator refused it. */
  readonly send: (command: OrchestrationV2ServerCommand) => Effect.Effect<boolean>;
}

export const makeCollisionsSource = Effect.gen(function* () {
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const events = yield* OrchestrationEventStore.OrchestrationEventStore;
  const projects = yield* ProjectService.ProjectService;
  const startup = yield* ServerRuntimeStartup.ServerRuntimeStartup;
  const crypto = yield* Crypto.Crypto;

  const edits = (afterSequence: number) =>
    events
      .streamProjectedApplicationEvents({
        afterSequence,
        project: (stored) => {
          if ("aggregateKind" in stored) return { sequence: stored.sequence, edit: null };
          const { event } = stored;
          const edit: FinishedEdit | null =
            event.type === "turn-item.updated" &&
            event.payload.type === "file_change" &&
            event.payload.status === "completed"
              ? {
                  threadId: event.threadId,
                  fileName: event.payload.fileName,
                  at: DateTime.toEpochMillis(event.payload.completedAt ?? event.payload.updatedAt),
                }
              : null;
          return { sequence: stored.sequence, edit };
        },
      })
      .pipe(
        Stream.map((projected) => projected.edit),
        Stream.filter((edit): edit is FinishedEdit => edit !== null),
        Stream.orDie,
      );

  return {
    ready: startup.awaitCommandReady.pipe(Effect.orDie),
    sequence: events.latestApplicationSequence.pipe(Effect.orDie),
    edits,
    shell: (threadId) => threads.getThreadShell(threadId).pipe(Effect.orElseSucceed(() => null)),
    project: (projectId) =>
      projects.listShells({ projectIds: [ProjectId.make(projectId)] }).pipe(
        Effect.map(([project]) =>
          project === undefined
            ? null
            : {
                root: project.workspaceRoot,
                repo: project.repositoryIdentity
                  ? repositoryGroupingKeyOf(project.repositoryIdentity)
                  : `project:${project.id}`,
              },
        ),
        Effect.orElseSucceed(() => null),
      ),
    newId: crypto.randomUUIDv4().pipe(Effect.orDie),
    send: (command) =>
      threads.dispatch(command).pipe(
        Effect.as(true),
        Effect.catchCause((cause) =>
          Effect.logInfo("A collision notice was refused", { cause }).pipe(Effect.as(false)),
        ),
      ),
  } satisfies CollisionsSource;
});
