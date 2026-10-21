/**
 * What a stopped Cell's resume takes from upstream on the web
 * (stemcells/tasks/limit-resume.md): the composer drafts, a POST to this
 * Mac's server as upstream authenticates its requests, and the continuation
 * upstream's composer sends as "Resume thread".
 */
import { parseScopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { RunId, ThreadId, type EnvironmentId } from "@t3tools/contracts";

import { composerDraftHasUserContent, useComposerDraftStore } from "~/composerDraftStore";
import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";
import { readDesktopPrimaryBearerToken } from "~/environments/primary/desktopAuth";
import { newMessageId } from "~/lib/utils";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { readThreadShell } from "~/state/entities";
import { primaryEnvironmentIdAtom } from "~/state/primaryEnvironment";
import { threadEnvironment } from "~/state/threads";

export { toastManager } from "~/components/ui/toast";

/**
 * Settings' "Auto-resume limited threads" on a Cell's server: on, its server
 * carries a stopped Cell on by itself.
 */
export const useAutoResume = (environmentId: string): boolean =>
  useEnvironmentSettings(
    environmentId as EnvironmentId,
    (settings) => settings.autoResumeLimitedThreads,
  );

/** The line upstream's "Resume thread" sends, and the server's resume too. */
export const CONTINUE_LINE = "Continue where you left off.";

/** The chats on this Mac's server with words in a composer here, sorted. */
export function draftedThreadIds(): string[] {
  const primary = appAtomRegistry.get(primaryEnvironmentIdAtom);
  if (primary === null) return [];
  const { draftsByThreadKey } = useComposerDraftStore.getState();
  return Object.entries(draftsByThreadKey)
    .flatMap(([key, draft]) => {
      const ref = parseScopedThreadKey(key);
      return ref !== null && ref.environmentId === primary && composerDraftHasUserContent(draft)
        ? [ref.threadId as string]
        : [];
    })
    .toSorted();
}

/** Calls `listener` whenever any composer's draft changes. */
export const onDraftsChange = (listener: () => void): (() => void) =>
  useComposerDraftStore.subscribe(listener);

/** A JSON POST to this Mac's server: the session cookie in a browser, the desktop app's token otherwise. */
export async function postToPrimary(pathname: string, body: unknown): Promise<Response> {
  const bearerToken = await readDesktopPrimaryBearerToken();
  return fetch(resolvePrimaryEnvironmentHttpUrl(pathname), {
    method: "POST",
    credentials: bearerToken ? "omit" : "include",
    headers: {
      "content-type": "application/json",
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export type ContinueOutcome = { readonly ok: true } | { readonly ok: false; readonly why: string };

/**
 * Carries a stopped Cell on now, as upstream's "Resume thread" does: its
 * line, guarded by the run the limit stopped, so it does nothing once
 * anything ran since.
 */
export async function continueCell(
  cell: { readonly environmentId: string; readonly threadId: string },
  runId: string,
): Promise<ContinueOutcome> {
  const environmentId = cell.environmentId as EnvironmentId;
  const threadId = ThreadId.make(cell.threadId);
  const shell = readThreadShell(scopeThreadRef(environmentId, threadId));
  if (shell === null) return { ok: false, why: "That Cell is gone." };
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.startTurn,
    {
      environmentId,
      input: {
        threadId,
        manualContinuationOfRunId: RunId.make(runId),
        message: { messageId: newMessageId(), role: "user", text: CONTINUE_LINE, attachments: [] },
        runtimeMode: shell.runtimeMode,
        interactionMode: shell.interactionMode,
        dispatchMode: "start",
      },
    },
    { reportFailure: false },
  );
  if (result._tag === "Success") return { ok: true };
  const error = squashAtomCommandFailure(result);
  return { ok: false, why: error instanceof Error ? error.message : "Couldn't continue." };
}
