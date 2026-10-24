/**
 * A tab carried into another window's strip joins that window
 * (stemcells/tasks/windows.md, Into another window's strip).
 */
import { ASKI_TAB_ID, isAskiTab } from "../tabs/askiTab";
import { windowById } from "./arrangement";
import { windowsBridge } from "./bridge";
import { join } from "./moves";
import { commitMove } from "./wire";

/**
 * Moves `tabId` from this window into window `host`, at `slot` among its
 * Cells' chips (Aski's tab, if it holds it, stays first). The host's id;
 * null when it can't.
 */
export async function joinWindow(
  tabId: string,
  host: string,
  slot: number,
): Promise<string | null> {
  if (!windowsBridge()) return null;
  const moved = await commitMove(({ arrangement }) => {
    const target = windowById(arrangement, host);
    if (!target) return null;
    const first = target.workspace.tabs[0];
    return join(arrangement, tabId, host, slot + (first && isAskiTab(first) ? 1 : 0));
  });
  return moved ? host : null;
}

/**
 * Aski comes to the window the person goes to it in: its tab joins this
 * one, first. Going to Aski never sends the person to another window, so a
 * swipe to Aski's place always lands where they are.
 */
export async function bringAskiHere(): Promise<boolean> {
  const bridge = windowsBridge();
  if (!bridge) return false;
  const moved = await commitMove(({ arrangement }) =>
    join(arrangement, ASKI_TAB_ID, bridge.boot.id, 0),
  );
  return moved !== null;
}
