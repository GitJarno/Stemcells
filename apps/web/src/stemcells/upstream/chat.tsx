/**
 * The tabs' view of upstream's chats: how to open one, whether it still
 * exists, and the view that renders it. Its title is in `thread.ts`.
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
import { ChatPanelHostContext } from "./chatPanel";
import { routeTargetForCell, threadRefOf, type ThreadRouteTarget } from "./routes";

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
 * When the user last wrote in the Cell's chat: an ISO time, null while it
 * holds no message of theirs (a draft), undefined while that isn't known yet
 * (its environment's thread list is loading). Older servers don't tell the
 * user's own messages apart; there, any user-role message counts.
 */
export function useCellLastSent(cell: CellRef | null): string | null | undefined {
  const shell = useQuietThreadShell(cell ? threadRefOf(cell) : null);
  const presence = useCellPresence(cell);
  if (shell !== null && shell.deletedAt == null) {
    return shell.latestUserAuthoredMessageAt !== undefined
      ? shell.latestUserAuthoredMessageAt
      : shell.latestUserMessageAt;
  }
  return presence.liveness === "alive" ? null : undefined;
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
 *
 * The pane that owns input also owns the tab's workbench (`panelHost`): its
 * thread's surfaces show there, and the other panes show none. Off stage, the
 * focused pane keeps its Surface's frame there (`chatPanel.tsx`).
 */
export function ChatPaneView(props: {
  target: ThreadRouteTarget;
  ownsWindowInput: boolean;
  /** Whether the pane is its tab's focused one (on stage or not). */
  focused: boolean;
  panelHost: HTMLElement | null;
}) {
  const appComposerRef = useComposerHandleContext();
  const paneComposerRef = useRef<ChatComposerHandle | null>(null);
  return (
    <ComposerHandleContext
      value={props.ownsWindowInput && appComposerRef ? appComposerRef : paneComposerRef}
    >
      <ChatWindowInputContext value={props.ownsWindowInput}>
        <ChatPanelHostContext
          value={{ node: props.panelHost, owns: props.ownsWindowInput, focused: props.focused }}
        >
          <ThreadRouteView target={props.target} />
        </ChatPanelHostContext>
      </ChatWindowInputContext>
    </ComposerHandleContext>
  );
}
