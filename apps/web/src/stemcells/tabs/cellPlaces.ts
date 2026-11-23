/** Where the workspace's Cells are, for what opens a chat from outside it (`commands.ts`). */
import { shownElsewhere } from "../windows/elsewhere";
import { isAskiTab } from "./askiTab";
import type { CellPlaces } from "./commands";
import { activeTab, panesOf, paneShowing, sameChat } from "./layout";
import { readWorkspace } from "./store";

export const cellPlaces = (focusPane: (paneId: string) => void): CellPlaces => ({
  isOpen: (cell) => paneShowing(readWorkspace(), cell) !== null || shownElsewhere(cell) !== null,
  focusPanel: (cell) => {
    const tab = activeTab(readWorkspace());
    if (isAskiTab(tab)) return false;
    const pane = tab
      ? panesOf(tab).find((each) => each.cell !== null && sameChat(each.cell, cell))
      : undefined;
    if (pane && pane.id !== tab?.focusedPaneId) focusPane(pane.id);
    return true;
  },
});
