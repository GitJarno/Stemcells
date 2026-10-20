/**
 * The tabs' view of upstream's chats: how to open one, its title, whether it
 * still exists, and the view that renders it.
 */
import type { EnvironmentId } from "@t3tools/contracts";
import { useRef } from "react";

import type { ChatComposerHandle } from "../../components/chat/ChatComposer";
import { ChatWindowInputContext } from "../../components/chat/chatWindowInput";
import { ThreadRouteView } from "../../components/ThreadRouteView";
import { useComposerDraftStore, type DraftId } from "../../composerDraftStore";
import { ComposerHandleContext, useComposerHandleContext } from "../../composerHandleContext";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { resolveThreadActionProjectRef } from "../../lib/chatThreadActions";
import { useQuietThreadShell } from "../../state/entities";
import { useEnvironmentShellStatus } from "../../state/shell";
import { isThreadRouteSnapshotAuthoritative } from "../../threadRoutes";
import type { CellRef } from "../tabs/layout";
import { routeTargetForCell, threadRefOf, type ThreadRouteTarget } from "./routes";

/** The chat's title once it is a thread; null while it is an unsent draft. */
export function useCellTitle(cell: CellRef | null): string | null {
  return useQuietThreadShell(cell ? threadRefOf(cell) : null)?.title ?? null;
}

type CellLiveness = "alive" | "gone" | "unknown";

/**
 * Whether a chat can still be shown, and the route that shows it: the thread
 * once the server lists it, else the draft. "unknown" until its environment's
 * thread list has loaded.
 */
export function useCellPresence(cell: CellRef | null): {
  readonly liveness: CellLiveness;
  readonly target: ThreadRouteTarget | null;
} {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const draftId = cell?.draftId ?? null;
  const draftExists = useComposerDraftStore((store) =>
    draftId === null ? false : store.getDraftSession(draftId as DraftId) !== null,
  );
  const shellStatus = useEnvironmentShellStatus(
    cell ? (cell.environmentId as EnvironmentId) : null,
  );
  if (cell === null) return { liveness: "gone", target: null };
  if (shell !== null && shell.deletedAt == null) {
    return { liveness: "alive", target: { kind: "server", threadRef: threadRefOf(cell) } };
  }
  if (draftExists) return { liveness: "alive", target: routeTargetForCell(cell) };
  return {
    liveness: isThreadRouteSnapshotAuthoritative(shellStatus) ? "gone" : "unknown",
    target: null,
  };
}

/**
 * Opens a new draft in the project of the chat the route shows (else the
 * first project), through upstream's own "new thread", which also routes to
 * it. Null when there is no project or the user moved on meanwhile.
 */
export function useOpenNewCell(): () => Promise<CellRef | null> {
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread } =
    useHandleNewThread();
  return async () => {
    const projectRef = resolveThreadActionProjectRef({
      activeDraftThread,
      activeThread: activeThread ?? undefined,
      defaultProjectRef,
      handleNewThread,
    });
    if (!projectRef) return null;
    const opened = await handleNewThread(projectRef);
    if (!opened) return null;
    const session = useComposerDraftStore.getState().getDraftSession(opened.draftId);
    return {
      environmentId: session?.environmentId ?? projectRef.environmentId,
      threadId: opened.threadId,
      draftId: opened.draftId,
    };
  };
}

/**
 * Upstream's thread view for one pane. Only the pane that owns window input
 * answers shortcuts, typing and paste that reach the window.
 *
 * Upstream shares one composer handle app-wide (the command palette provides
 * it, and a chat's composer fills it), as there is one chat on screen. Each
 * pane's composer fills a handle of its own; the pane that owns input fills
 * the app's, so the palette and window shortcuts reach the focused chat.
 */
export function ChatPaneView(props: { target: ThreadRouteTarget; ownsWindowInput: boolean }) {
  const appComposerRef = useComposerHandleContext();
  const paneComposerRef = useRef<ChatComposerHandle | null>(null);
  return (
    <ComposerHandleContext
      value={props.ownsWindowInput && appComposerRef ? appComposerRef : paneComposerRef}
    >
      <ChatWindowInputContext value={props.ownsWindowInput}>
        <ThreadRouteView target={props.target} />
      </ChatWindowInputContext>
    </ComposerHandleContext>
  );
}
