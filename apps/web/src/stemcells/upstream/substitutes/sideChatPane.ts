/**
 * Replaces `lib/sideChatPane.ts` (`plugin.ts`): where a Subcell, a side chat or a linked thread
 * opens, in our workspace. The main view is a pane beside the click's own, so the Cell being read
 * stays; a thread already open as a Cell is brought forward, not shown again in a panel; and from
 * Aski's tab, whose chats draw no panel, all of them open in the main view.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  openLinkedThreadRead as openUpstreamLinkedThreadRead,
  openSideThread as openUpstreamSideThread,
  resolveThreadOpenRoute as resolveUpstreamThreadOpenRoute,
} from "../../../lib/sideChatPane";
import {
  rightPanelHostRef,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../../../rightPanelStore";
import { focusCellPanel, isCellOpen, openCellBeside } from "../../tabs/commands";
import type { CellRef } from "../../tabs/layout";

export { isInSideChatPane, type SideChatParentPanel } from "../../../lib/sideChatPane";

const cellOf = ({ environmentId, threadId }: ScopedThreadRef): CellRef => ({
  environmentId,
  threadId,
  draftId: null,
});

/** The thread whose panel a click opens in, its pane focused: Enter on a row focuses none. */
function panelHost(panelRef: ScopedThreadRef | null): ScopedThreadRef | null {
  const host = panelRef === null ? null : rightPanelHostRef(panelRef);
  return host !== null && focusCellPanel(cellOf(host)) ? host : null;
}

export function openSideThread(input: Parameters<typeof openUpstreamSideThread>[0]) {
  const { threadRef, intent } = input;
  const host = panelHost(input.panelRef);
  return openUpstreamSideThread({
    threadRef,
    panelRef: host,
    intent: intent !== "panel" && isCellOpen(cellOf(threadRef)) ? "main" : intent,
    navigate: (ref) => {
      if (!openCellBeside(cellOf(ref))) {
        input.navigate(ref);
        return;
      }
      // On screen beside its host now, so its tab goes, as upstream's move to the main view does.
      const store = useRightPanelStore.getState();
      const shown =
        host &&
        selectThreadRightPanelState(store.byThreadKey, host).surfaces.find(
          (surface) => surface.kind === "thread" && surface.threadId === ref.threadId,
        );
      if (shown) store.closeSurface(host, shown.id);
    },
  });
}

export function openLinkedThreadRead(input: Parameters<typeof openUpstreamLinkedThreadRead>[0]) {
  openUpstreamLinkedThreadRead({ ...input, panelRef: panelHost(input.panelRef) });
}

export function resolveThreadOpenRoute(
  ...[threadRef, thread]: Parameters<typeof resolveUpstreamThreadOpenRoute>
) {
  return isCellOpen(cellOf(threadRef))
    ? threadRef
    : resolveUpstreamThreadOpenRoute(threadRef, thread);
}
