import { useLocation } from "@tanstack/react-router";

import { litFor } from "../rail/lit";
import { ASKI_TAB_ID } from "../tabs/askiTab";
import { useWorkspaceStore } from "../tabs/store";

/**
 * Whether Aski's room is the page in front: its tab is the active one and no page of the app's
 * own (Settings, Usage) covers the workspace. Its asks are then on its right half, so the Cells'
 * column lists them as an index (stemcells/tasks/aski-asks.md, decision 8).
 */
export function useAskiRoomInFront(): boolean {
  const askiActive = useWorkspaceStore((store) => store.workspace.activeTabId === ASKI_TAB_ID);
  const covered = useLocation({ select: (location) => litFor(location.pathname) !== null });
  return askiActive && !covered;
}
