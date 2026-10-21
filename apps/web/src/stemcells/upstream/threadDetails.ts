/**
 * Upstream's thread details card: where the chat runs, Open in, project
 * scripts and Git. Upstream opens it beside every chat wide enough to hold
 * it; a Cell starts with it closed, and the pane's ≡ button opens it.
 * workspace.css hangs it below the pane's buttons
 * (threadDetails.contract.test.ts).
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { useLayoutEffect } from "react";

import { useRightPanelStore } from "../../rightPanelStore";
import { useCellForRoute } from "./drafts";
import type { ThreadRouteTarget } from "./routes";

/** The chats this page has shown, by upstream's thread key. */
const shownChats = new Set<string>();

/**
 * Closes the chat's card the first time the page shows the chat. Later
 * showings leave it as the person last set it. Upstream keeps a closed card
 * across reloads but an open one only until then, as open is its default.
 */
export function closeDetailsOnFirstShow(ref: ScopedThreadRef, shown = shownChats): void {
  const key = scopedThreadKey(ref);
  if (shown.has(key)) return;
  shown.add(key);
  useRightPanelStore.getState().setThreadPanelOpen(ref, "inline", false);
}

/** Starts the card of the chat a pane shows closed, before the pane paints. */
export function useDetailsClosedAtFirst(target: ThreadRouteTarget | null): void {
  const cell = useCellForRoute(target);
  const environmentId = cell?.environmentId ?? null;
  const threadId = cell?.threadId ?? null;
  useLayoutEffect(() => {
    if (environmentId === null || threadId === null) return;
    closeDetailsOnFirstShow(scopeThreadRef(environmentId as EnvironmentId, threadId as ThreadId));
  }, [environmentId, threadId]);
}
