/**
 * Undo Move (⌥⌘Z, stemcells/tasks/windows.md): takes the latest move between
 * windows back, while what it moved is still where it put it. A move that
 * can't be taken back any more is forgotten, and the one before it is
 * offered.
 */
import { windowsBridge } from "./bridge";
import { undo } from "./moves";
import { commitMove, readUndo } from "./wire";

/** True when a move was taken back. */
export async function undoMove(): Promise<boolean> {
  const bridge = windowsBridge();
  if (!bridge) return false;
  for (const kept of await bridge.undos()) {
    const entry = readUndo(kept.entry);
    // Whether it still applies, as the windows are now (a stale commit is tried again).
    let applies = entry !== null;
    if (entry) {
      const taken = await commitMove((seen) => {
        const back = undo(seen.arrangement, entry);
        applies = back !== null;
        return back;
      }, kept.id);
      if (taken) return true;
      if (applies) return false;
    }
    bridge.dropUndo(kept.id);
  }
  return false;
}
