/**
 * The chats the other windows hold, kept as they publish them, so going to a
 * chat open in another window brings that window forward instead of opening
 * the chat a second time here: a chat lives in one place.
 */
import { useSyncExternalStore } from "react";

import { isAskiTab } from "../tabs/askiTab";
import {
  paneShowing,
  parseWorkspace,
  type CellRef,
  type Tab,
  type Workspace,
} from "../tabs/layout";
import { windowsBridge, type WindowElsewhere } from "./bridge";

const bridge = windowsBridge();
const others = new Map<string, Workspace>();

/** Aski's tab, when another window holds it. */
let askiAway: Tab | null = null;
const listeners = new Set<() => void>();

function findAski(): Tab | null {
  for (const workspace of others.values()) {
    const tab = workspace.tabs.find(isAskiTab);
    if (tab) return tab;
  }
  return null;
}

function hear({ id, workspace }: WindowElsewhere): void {
  if (workspace === null) others.delete(id);
  else others.set(id, parseWorkspace(workspace));
  const aski = findAski();
  if (JSON.stringify(aski) === JSON.stringify(askiAway)) return;
  askiAway = aski;
  for (const listener of listeners) listener();
}

for (const window of bridge?.boot.others ?? []) hear(window);
bridge?.onElsewhere(hear);

/** The other window and pane showing `cell`, if one does. */
export function shownElsewhere(cell: CellRef): { window: string; pane: string } | null {
  for (const [window, workspace] of others) {
    const holder = paneShowing(workspace, cell);
    if (holder) return { window, pane: holder.pane.id };
  }
  return null;
}

/**
 * Brings forward the other window showing `cell`, focused on its pane. False
 * when no other window shows it (or there are no other windows).
 */
export function revealElsewhere(cell: CellRef): boolean {
  const shown = bridge ? shownElsewhere(cell) : null;
  if (!bridge || !shown) return false;
  bridge.reveal(shown.window, shown.pane);
  return true;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * Aski's tab while another window holds it, else null. Aski's place in this
 * window's strip then brings it here (`bringAskiHere`).
 */
export function askiElsewhere(): Tab | null {
  return askiAway;
}

export function useAskiElsewhere(): Tab | null {
  return useSyncExternalStore(subscribe, askiElsewhere, askiElsewhere);
}
