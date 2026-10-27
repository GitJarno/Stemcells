// What the phone's asks take from upstream (stemcells/tasks/phone-line.md): its own thread
// commands, run as its chat runs them, a shell's mode for a message, the settle a Cell at work
// stops for first, T3's notice, which steps aside for an answer's undo line, and the views an
// ask is drawn with. Only `respond` with an allow decision can approve, and only a tap reaches it.

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

import { buildPlanImplementationPrompt } from "../../../../web/src/proposedPlan";
import { uuidv4 } from "../../lib/uuid";
import { appAtomRegistry } from "../../state/atom-registry";
import { readEnvironmentScope } from "../../state/session";
import { environmentThreadShells, threadEnvironment } from "../../state/threads";
import type { ThreadCommand } from "../line/kit";

export { AppTextInput } from "../../components/ui/AppText";
export { Toast } from "../../components/ui/Toast";
export * as Dialog from "../../components/ui/Dialog";
export {
  dismissThreadUndoNotice,
  useThreadUndoNotice,
} from "../../features/home/thread-undo-notice";
export { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
export { useWorkspaceTabs } from "../../features/workspace/WorkspaceTabsContext";
export { relativeTime } from "../../lib/time";

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
          message: message(buildPlanImplementationPrompt(command.markdown)),
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

const RUNNING = new Set(["preparing", "starting", "running", "waiting"]);
/** How long a stopped Cell has to end its run before its settle gives up. */
const STOP_WAIT_MS = 15_000;

/**
 * Settles a Cell with `settle` (upstream's own, with its notice), from any stage: upstream
 * refuses a thread that runs or waits on an answer, so a Cell at work stops first, as the
 * column's Settle does (`apps/web/src/stemcells/upstream/settle.ts`).
 */
export async function settleFromAnyStage(
  environmentIdText: string,
  threadIdText: string,
  settle: () => Promise<boolean>,
): Promise<"settled" | "unstopped" | "refused"> {
  const ref = scopeThreadRef(environmentIdText as EnvironmentId, ThreadId.make(threadIdText));
  const atom = environmentThreadShells.threadShellAtom(ref);
  const runs = () => RUNNING.has(appAtomRegistry.get(atom)?.source.status ?? "");
  const asking = appAtomRegistry.get(atom)?.source.pendingRuntimeRequest ?? null;
  if (runs() || (asking !== null && asking.blocking !== false)) {
    const stopped = await run(threadEnvironment.interruptTurn, {
      environmentId: ref.environmentId,
      input: { threadId: ref.threadId },
    });
    if (!stopped.ok) return "unstopped";
    const ended = await new Promise<boolean>((resolve) => {
      if (!runs()) return resolve(true);
      const timer = setTimeout(() => done(false), STOP_WAIT_MS);
      const unsubscribe = appAtomRegistry.subscribe(atom, () => {
        if (!runs()) done(true);
      });
      function done(value: boolean) {
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      }
    });
    if (!ended) return "unstopped";
  }
  // Upstream's settle says itself why it refused.
  return (await settle()) ? "settled" : "refused";
}
