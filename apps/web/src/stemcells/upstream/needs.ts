/**
 * What Aski's page takes from upstream to answer a Cell (stemcells/tasks/aski-room.md, "Action
 * catalogue"): the primary environment's stream of what needs the person, a thread's live
 * shell, and upstream's own chat's thread commands, run as it runs them. Only `respond` with an
 * allow decision can approve, and only a click on Aski's page reaches it.
 */
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  runAtomCommand,
  squashAtomCommandFailure,
  type AtomCommand,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  PlanId,
  ProviderInstanceId,
  RunId,
  RuntimeRequestId,
  ProjectId,
  ThreadId,
  type EnvironmentId,
  type ProviderApprovalDecision,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";

import { composerDraftHasUserContent, useComposerDraftStore } from "~/composerDraftStore";
import { useNowMinute } from "~/hooks/useNowMinute";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { newMessageId } from "~/lib/utils";
import { buildPlanImplementationPrompt } from "~/proposedPlan";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readThreadShell, useProject } from "~/state/entities";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { readEnvironmentScope } from "~/state/session";
import { threadEnvironment } from "~/state/threads";

import type { ThreadCommand } from "../needs/actions";
import { repositoryUrlOf } from "../needs/inline";
import { markHandSettle, unmarkHandSettle } from "../tabs/handSettles";

export type ApprovalDecision = ProviderApprovalDecision;
export { usePrimaryEnvironmentId } from "~/state/environments";
/**
 * A minute of upstream's clock in ms. It names the minute in UTC without
 * the zone ("2026-10-21T09:17"), which `Date.parse` alone would read as
 * local time, hours off anywhere but UTC.
 */
export const minuteMs = (minute: string): number => Date.parse(`${minute}:00Z`);

/** The current minute in ms, ticking each minute, on upstream's clock. */
export const useNowMinuteMs = (): number => minuteMs(useNowMinute());
export { observeResize } from "~/lib/observeResize";
/** Upstream's chat markdown, which draws an ask's words and opens its links as the chat does. */
export { default as ChatMarkdown } from "~/components/ChatMarkdown";

/** A Cell's chat as upstream's markdown takes it: its links open in that chat's browser. */
export const cellRef = (environmentId: string, threadId: string) =>
  scopeThreadRef(environmentId as EnvironmentId, ThreadId.make(threadId));

/** Where an issue number in a Cell's words points: its project's repository, on GitHub. */
export function useRepositoryUrl(environmentId: string | null, projectId: string): string | null {
  const project = useProject(
    environmentId === null
      ? null
      : scopeProjectRef(environmentId as EnvironmentId, ProjectId.make(projectId)),
  );
  return repositoryUrlOf(project?.repositoryIdentity);
}

/** Upstream's composer, inside a chat pane: the sheet over Aski's chat stops above it. */
export const COMPOSER_SURFACE_SELECTOR = '[data-chat-composer-surface="true"]';

/** What is in a chat's composer now, unsent; "" for none. */
export function useDraftText(cell: { environmentId: string; threadId: string } | null): string {
  return useComposerDraftStore((store) => {
    if (cell === null) return "";
    const draft = store.getComposerDraft(
      scopeThreadRef(cell.environmentId as EnvironmentId, ThreadId.make(cell.threadId)),
    );
    return composerDraftHasUserContent(draft) ? (draft?.prompt ?? "") || " " : "";
  });
}

/**
 * A GET to the primary environment's server that stays open: the session
 * cookie in a browser on its origin, the desktop app's bearer token
 * otherwise, as upstream authenticates its own requests.
 */
export async function openPrimaryStream(pathname: string, signal: AbortSignal): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname), {
    signal,
    credentials: bearerToken ? "omit" : "include",
    headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
  });
}

export type { ThreadCommand };

export type CommandOutcome = { readonly ok: true } | { readonly ok: false; readonly why: string };

const NOT_ALLOWED = "This connection can't change Cells.";

async function run<W, A, E>(command: AtomCommand<W, A, E>, value: W): Promise<CommandOutcome> {
  const result = await runAtomCommand(appAtomRegistry, command, value, { reportFailure: false });
  if (result._tag === "Success") return { ok: true };
  const error = squashAtomCommandFailure(result);
  return { ok: false, why: error instanceof Error ? error.message : "Couldn't send." };
}

/** Sends one command to a thread on the primary environment, through upstream's own path. */
export async function sendThreadCommand(
  threadIdText: string,
  command: ThreadCommand,
): Promise<CommandOutcome> {
  const environmentId = appAtomRegistry.get(primaryEnvironmentIdAtom);
  if (environmentId === null) return { ok: false, why: "Not connected to this Mac's server." };
  if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
    return { ok: false, why: NOT_ALLOWED };
  }
  const threadId = ThreadId.make(threadIdText);
  const shell = readThreadShell(scopeThreadRef(environmentId, threadId));
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
    case "message": {
      if (shell === null) return { ok: false, why: "That Cell is gone." };
      return run(threadEnvironment.startTurn, {
        environmentId,
        input: {
          threadId,
          message: { messageId: newMessageId(), role: "user", text: command.text, attachments: [] },
          runtimeMode: shell.runtimeMode,
          interactionMode: command.interactionMode ?? shell.interactionMode,
          // A continuation must start now; anything else steers or queues
          // as the Cell's own composer would, unless the card chose which.
          dispatchMode:
            command.continuationOfRunId !== undefined ? "start" : (command.delivery ?? "auto"),
          ...(command.continuationOfRunId === undefined
            ? {}
            : { manualContinuationOfRunId: RunId.make(command.continuationOfRunId) }),
        },
      });
    }
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
          message: {
            messageId: newMessageId(),
            role: "user",
            text: buildPlanImplementationPrompt(command.markdown),
            attachments: [],
          },
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
    case "settle": {
      // The person's "Nothing to do", so the Cell's pane closes for it.
      const thread = { environmentId, threadId };
      markHandSettle(thread);
      const outcome = await run(threadEnvironment.settle, { environmentId, input: { threadId } });
      if (!outcome.ok) unmarkHandSettle(thread);
      return outcome;
    }
  }
}

/** Brings a snoozed Cell back now, as the sidebar's own unsnooze does. */
export async function unsnoozeCell(threadIdText: string): Promise<CommandOutcome> {
  const environmentId = appAtomRegistry.get(primaryEnvironmentIdAtom);
  if (environmentId === null) return { ok: false, why: "Not connected to this Mac's server." };
  if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope)) {
    return { ok: false, why: NOT_ALLOWED };
  }
  return run(threadEnvironment.unsnooze, {
    environmentId,
    input: { threadId: ThreadId.make(threadIdText), reason: "user" },
  });
}

/** Opens a Cell's own chat beside Aski, or the provider's setup for a sign-in. */
export function useOpenFromNeeds() {
  const navigate = useNavigate();
  const environmentId = () => appAtomRegistry.get(primaryEnvironmentIdAtom);
  return {
    chat: (threadId: string) => {
      const id = environmentId();
      if (id === null) return;
      void navigate({ to: "/$environmentId/$threadId", params: { environmentId: id, threadId } });
    },
    providerSetup: (instanceIdText: string) => {
      const id = environmentId();
      const instanceId = ProviderInstanceId.make(instanceIdText);
      void navigate({
        to: "/settings/providers",
        search: id === null ? { instanceId } : { environmentId: id, instanceId },
      });
    },
  };
}
