/**
 * Aski's tab across windows: it lives in one window, first in its strip.
 * The window holding it keeps it up to date; when no window holds it, the
 * lead window seats it. A window the person closes sends it home there.
 */
import { askiTabOf } from "../tabs/askiTab";
import { insertTab, type Workspace } from "../tabs/layout";
import { windowsBridge } from "./bridge";
import { isLeadWindow } from "./lead";
import { readSnapshot } from "./wire";

/**
 * Seats Aski's tab here (`seat`) if this window holds it, or leads while no
 * other window does. Without other windows to ask, at once.
 */
export function seatAskiHere(workspace: Workspace, seat: () => void): void {
  const bridge = windowsBridge();
  if (!bridge || askiTabOf(workspace)) {
    seat();
    return;
  }
  if (!isLeadWindow()) return;
  void bridge.snapshot().then((snapshot) => {
    const { arrangement } = readSnapshot(snapshot);
    const elsewhere = arrangement.windows.some(
      (window) => window.id !== bridge.boot.id && askiTabOf(window.workspace),
    );
    if (!elsewhere && isLeadWindow()) seat();
  });
}

/** The workspace with Aski's tab from a closed window's, first, unless one is here already. */
export function welcomeAskiHome(workspace: Workspace, closed: Workspace): Workspace {
  const aski = askiTabOf(closed);
  return aski && !askiTabOf(workspace) ? insertTab(workspace, aski, 0) : workspace;
}
