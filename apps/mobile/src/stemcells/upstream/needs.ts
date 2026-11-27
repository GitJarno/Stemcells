// What the phone's asks take from upstream (stemcells/tasks/phone-line.md): its thread commands,
// run as its chat runs them, T3's notice, the views an ask is drawn with, and a chat's messages
// and jump for the ask it docks. Only `respond` with an allow decision can approve, and only a
// tap reaches it.

import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  runAtomCommand,
  squashAtomCommandFailure,
  type AtomCommand,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  MessageId,
  PlanId,
  RunId,
  RuntimeRequestId,
  ThreadId,
  type EnvironmentId,
} from "@t3tools/contracts";

import { requestThreadMessageJump } from "../../features/threads/threadMessageJump";
import { scopedThreadKey } from "../../lib/scopedEntities";
import { uuidv4 } from "../../lib/uuid";
import { appAtomRegistry } from "../../state/atom-registry";
import { readEnvironmentScope } from "../../state/session";
import { environmentThreadShells, threadEnvironment } from "../../state/threads";
import { useQuietThreadStructure } from "../../state/use-thread-detail";
import { buildPlanMessage, type ChatMessage, type ThreadCommand } from "../line/kit";

export { Toast } from "../../components/ui/Toast";
export * as Dialog from "../../components/ui/Dialog";
export {
  dismissThreadUndoNotice,
  useThreadUndoNotice,
} from "../../features/home/thread-undo-notice";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { relativeTime } from "../../lib/time";
export { useDeviceType } from "../../native/native-layout-metrics";

export type CommandOutcome = { readonly ok: true } | { readonly ok: false; readonly why: string };

async function run<W, A, E>(command: AtomCommand<W, A, E>, value: W): Promise<CommandOutcome> {
  const result = await runAtomCommand(appAtomRegistry, command, value, { reportFailure: false });
  if (result._tag === "Success") return { ok: true };
  const error = squashAtomCommandFailure(result);
  return { ok: false, why: error instanceof Error ? error.message : "Couldn't send." };
}

const shellOf = (environmentId: EnvironmentId, threadId: ThreadId) =>
  appAtomRegistry.get(
    environmentThreadShells.threadShellAtom(scopeThreadRef(environmentId, threadId)),
  );

/** Sends one command to a thread on `environmentIdText`, through upstream's own path. */
export async function sendThreadCommand(
  environmentIdText: string,
  threadIdText: string,
  command: ThreadCommand,
): Promise<CommandOutcome> {
  const environmentId = environmentIdText as EnvironmentId;
  if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope))
    return { ok: false, why: "This connection can't change Cells." };
  const threadId = ThreadId.make(threadIdText);
  const shell = shellOf(environmentId, threadId);
  const message = (text: string) => ({
    messageId: MessageId.make(uuidv4()),
    role: "user" as const,
    text,
    attachments: [],
  });
  switch (command.type) {
    case "respond":
      return run(threadEnvironment.respondToApproval, {
        environmentId,
        input: {
          threadId,
          requestId: RuntimeRequestId.make(command.requestId),
          decision: command.decision,
        },
      });
    case "answer":
      return run(threadEnvironment.respondToUserInput, {
        environmentId,
        input: {
          threadId,
          requestId: RuntimeRequestId.make(command.requestId),
          answers: command.answers,
        },
      });
    case "dismissQuestion":
      return run(threadEnvironment.dismissUserInput, {
        environmentId,
        input: { threadId, requestId: RuntimeRequestId.make(command.requestId) },
      });
    case "message":
      if (shell === null) return { ok: false, why: "That Cell is gone." };
      return run(threadEnvironment.startTurn, {
        environmentId,
        input: {
          threadId,
          message: message(command.text),
          runtimeMode: shell.runtimeMode,
          interactionMode: command.interactionMode ?? shell.interactionMode,
          // A continuation must start now; anything else steers or queues as its composer would.
          dispatchMode:
            command.continuationOfRunId !== undefined ? "start" : (command.delivery ?? "auto"),
          ...(command.continuationOfRunId === undefined
            ? {}
            : { manualContinuationOfRunId: RunId.make(command.continuationOfRunId) }),
        },
      });
    case "build": {
      if (shell === null) return { ok: false, why: "That Cell is gone." };
      const mode = await run(threadEnvironment.setInteractionMode, {
        environmentId,
        input: { threadId, interactionMode: "default" },
      });
      if (!mode.ok) return mode;
      return run(threadEnvironment.startTurn, {
        environmentId,
        input: {
          threadId,
          message: message(buildPlanMessage(command.markdown)),
          runtimeMode: shell.runtimeMode,
          interactionMode: "default",
          sourceProposedPlan: { threadId, planId: PlanId.make(command.planId) },
          dispatchMode: "start",
        },
      });
    }
    case "carryOnAtReset":
      return run(threadEnvironment.updateMetadata, {
        environmentId,
        input: {
          threadId,
          limitRecovery: {
            runId: RunId.make(command.runId),
            resetAt: command.resetAt,
            autoResume: true,
            snooze: true,
          },
        },
      });
    case "snooze":
      return run(threadEnvironment.snooze, {
        environmentId,
        input: { threadId, snoozedUntil: command.until },
      });
    case "visit":
      return run(threadEnvironment.visit, {
        environmentId,
        input: { threadId, visitedAt: command.visitedAt },
      });
    case "settle":
      return run(threadEnvironment.settle, { environmentId, input: { threadId } });
  }
}

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

/** A chat's messages, as of their last change but a streamed word: a reply's text once it ends. */
export function useChatMessages(
  environmentIdText: string,
  threadIdText: string,
): ReadonlyArray<ChatMessage> {
  const ref = scopeThreadRef(environmentIdText as EnvironmentId, ThreadId.make(threadIdText));
  return useQuietThreadStructure(ref)?.projection.messages ?? NO_MESSAGES;
}

/** Scrolls the chat on screen to a message, loading earlier history until it's there. */
export function jumpToMessage(environmentIdText: string, threadIdText: string, messageId: string) {
  requestThreadMessageJump(
    scopedThreadKey(environmentIdText as EnvironmentId, ThreadId.make(threadIdText)),
    MessageId.make(messageId),
  );
}
