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
import { isAskiTab } from "../../tabs/askiTab";
import { openCellBeside } from "../../tabs/commands";
import { activeTab, panesOf, paneShowing, sameChat, type CellRef } from "../../tabs/layout";
import { readWorkspace } from "../../tabs/store";
import { shownElsewhere } from "../../windows/elsewhere";

export { isInSideChatPane, type SideChatParentPanel } from "../../../lib/sideChatPane";

const cellOf = ({ environmentId, threadId }: ScopedThreadRef): CellRef => ({
  environmentId,
  threadId,
  draftId: null,
});

/** Open as a Cell, in a pane here or in another window. */
const openAsCell = (ref: ScopedThreadRef) =>
  paneShowing(readWorkspace(), cellOf(ref)) !== null || shownElsewhere(cellOf(ref)) !== null;

/** The thread whose panel a click in `panelRef` opens in; null where no panel would show. */
function hostOf(panelRef: ScopedThreadRef | null): ScopedThreadRef | null {
  return panelRef === null || isAskiTab(activeTab(readWorkspace()))
    ? null
    : rightPanelHostRef(panelRef);
}

/** Focuses the pane of `host`, whose panel shows only then: Enter on a row moves no focus. */
function focusPaneOf(host: ScopedThreadRef) {
  const tab = activeTab(readWorkspace());
  const pane = tab
    ? panesOf(tab).find((each) => each.cell !== null && sameChat(each.cell, cellOf(host)))
    : undefined;
  if (pane && pane.id !== tab?.focusedPaneId) openCellBeside(cellOf(host));
}

export function openSideThread(input: Parameters<typeof openUpstreamSideThread>[0]) {
  const { threadRef, intent } = input;
  const host = hostOf(input.panelRef);
  if (host) focusPaneOf(host);
  return openUpstreamSideThread({
    threadRef,
    panelRef: host,
    intent: intent !== "panel" && openAsCell(threadRef) ? "main" : intent,
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
  const host = hostOf(input.panelRef);
  if (host) focusPaneOf(host);
  openUpstreamLinkedThreadRead({ ...input, panelRef: host });
}

export function resolveThreadOpenRoute(
  ...[threadRef, thread]: Parameters<typeof resolveUpstreamThreadOpenRoute>
) {
  return openAsCell(threadRef) ? threadRef : resolveUpstreamThreadOpenRoute(threadRef, thread);
}
