/**
 * What linked environments take from upstream (stemcells/tasks/peers.md, "Across
 * environments"): this environment's id, its secret store, the projects' repositories, the
 * Cells at work in them, `t3_thread_send`'s mode rule for one thread writing to another, and
 * its way of sending a message to a thread.
 */
import {
  CommandId,
  MessageId,
  type OrchestrationV2ThreadShell,
  ProjectId,
  type ProviderInteractionMode,
  type RuntimeMode,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ServerSecretStore from "../../auth/ServerSecretStore.ts";
import * as ServerEnvironment from "../../environment/ServerEnvironment.ts";
import { resolveInteractionMode, resolveRuntimeMode } from "../../mcp/delegatedTaskModes.ts";
import { isNativeMaintenanceCommand } from "../../orchestration-v2/CommandPolicy.ts";
import * as Orchestrator from "../../orchestration-v2/Orchestrator.ts";
import * as ThreadManagementService from "../../orchestration-v2/ThreadManagementService.ts";
import * as ProjectService from "../../project/ProjectService.ts";
import * as ServerRuntimeStartup from "../../serverRuntimeStartup.ts";
import type { RosterThread } from "../peers/roster.ts";
import { repoKeysOf, rosterThreadOf } from "./peers.ts";

/** A thread here as the links read it: who's here's view, and what a message to it checks. */
export interface LiveThread extends RosterThread {
  readonly projectId: string;
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
}

export interface Modes {
  readonly runtimeMode: RuntimeMode;
  readonly interactionMode: ProviderInteractionMode;
}

export type Delivered = "started" | "steered" | "queued" | "restarted";

/** What the links service reads and does here. */
export interface LinkedSource {
  readonly environmentId: string;
  /** Until the server takes commands, nothing here is read. */
  readonly ready: Effect.Effect<void>;
  /** Each project's repository key (upstream's grouping, by its remote); a project with none is left out. */
  readonly repos: Effect.Effect<ReadonlyMap<string, string>>;
  /** The threads the person hasn't archived or settled. */
  readonly threads: Effect.Effect<ReadonlyArray<LiveThread>>;
  /** One thread; null once it is gone or can't be read. */
  readonly thread: (threadId: string) => Effect.Effect<LiveThread | null>;
  /** Whether a thread at `sender`'s modes may write to one at `recipient`'s, by `t3_thread_send`'s rule. */
  readonly modesAllow: (sender: Modes, recipient: Modes) => Effect.Effect<boolean>;
  /** Sends `text` to the thread as the app's, with no sender thread here; null when it was refused. */
  readonly deliver: (input: {
    readonly threadId: string;
    readonly projectId: string;
    readonly messageId: string;
    readonly text: string;
  }) => Effect.Effect<Delivered | null>;
  /** The links, kept whole in upstream's secret store (owner-only files): null when none were kept. */
  readonly vault: {
    readonly read: Effect.Effect<string | null>;
    readonly write: (text: string) => Effect.Effect<boolean>;
  };
}

const VAULT = "stemcells-peer-links";

/**
 * A message upstream runs as a command rather than words (`/compact`,
 * `/logout`): from another machine it would act on the recipient's
 * conversation, which no peer may do.
 */
export const isCommand = (text: string) => isNativeMaintenanceCommand({ text, attachments: [] });

/** `t3_thread_send`'s rule: a thread writes to no thread whose modes are broader than its own. */
export const modesAllow = (sender: Modes, recipient: Modes) =>
  Effect.all([
    resolveRuntimeMode(sender.runtimeMode, recipient.runtimeMode),
    resolveInteractionMode(sender.interactionMode, recipient.interactionMode),
  ]).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );

const liveThreadOf = (shell: OrchestrationV2ThreadShell): LiveThread => ({
  ...rosterThreadOf(shell),
  projectId: shell.projectId,
  runtimeMode: shell.runtimeMode,
  interactionMode: shell.interactionMode,
});

const isOpen = (shell: OrchestrationV2ThreadShell) =>
  shell.archivedAt === null && shell.deletedAt === null;

export const makeLinkedSource = Effect.gen(function* () {
  const projects = yield* ProjectService.ProjectService;
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  const threads = yield* ThreadManagementService.ThreadManagementService;
  const secrets = yield* ServerSecretStore.ServerSecretStore;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const startup = yield* ServerRuntimeStartup.ServerRuntimeStartup;
  const environmentId: string = yield* environment.getEnvironmentId;
  return {
    environmentId,
    ready: startup.awaitCommandReady.pipe(Effect.orDie),
    repos: repoKeysOf(projects),
    threads: orchestrator.getShellSnapshot({ location: "active", unsettledOnly: true }).pipe(
      Effect.map((snapshot) => snapshot.threads.filter(isOpen).map(liveThreadOf)),
      Effect.catchCause((cause) =>
        Effect.logWarning("Stemcells couldn't read the threads for its links", cause).pipe(
          Effect.as([]),
        ),
      ),
    ),
    thread: (threadId) =>
      threads.getThreadShell(ThreadId.make(threadId)).pipe(
        Effect.map((shell) => (shell === null || !isOpen(shell) ? null : liveThreadOf(shell))),
        Effect.orElseSucceed(() => null),
      ),
    modesAllow,
    deliver: ({ threadId, projectId, messageId, text }) =>
      threads
        .sendToThread({
          projectId: ProjectId.make(projectId),
          // The message's id names its sender; a retry replays this command's result.
          commandId: CommandId.make(`command:${messageId}`),
          threadId: ThreadId.make(threadId),
          messageId: MessageId.make(messageId),
          text,
          attachments: [],
          mode: "auto",
          createdBy: "agent",
          creationSource: "server",
        })
        .pipe(
          Effect.map((sent): Delivered => sent.delivery),
          Effect.catchCause((cause) =>
            Effect.logInfo("A message from a linked environment was refused", cause).pipe(
              Effect.as(null),
            ),
          ),
        ),
    vault: {
      read: secrets.get(VAULT).pipe(
        Effect.map(
          Option.match({ onNone: () => null, onSome: (bytes) => new TextDecoder().decode(bytes) }),
        ),
        Effect.catchCause((cause) =>
          Effect.logWarning("Stemcells couldn't read its links", cause).pipe(Effect.as(null)),
        ),
      ),
      write: (text) =>
        secrets.set(VAULT, new TextEncoder().encode(text)).pipe(
          Effect.as(true),
          Effect.catchCause((cause) =>
            Effect.logWarning("Stemcells couldn't keep its links", cause).pipe(Effect.as(false)),
          ),
        ),
    },
  } satisfies LinkedSource;
});
