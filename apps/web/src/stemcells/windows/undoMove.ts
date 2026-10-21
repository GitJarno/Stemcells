/**
 * Undo Move (⌥⌘Z, stemcells/tasks/windows.md): takes the latest move between
 * windows back, while what it moved is still where it put it and no chat it
 * would bring back is open anywhere else. The moves are a stack: the latest
 * goes back, or, if it can't any more, is forgotten and nothing changes; a
 * press never reaches past it to an older move. A press while a carry is in
 * the hand does nothing.
 */
import { windowsBridge } from "./bridge";
import { carrying } from "./carrying";
import { undo } from "./moves";
import { commitMove, readUndo } from "./wire";

/** What a press did: took the latest move back, forgot it, or found none. */
export type Undone = "undone" | "forgotten" | "none";

export async function undoMove(): Promise<Undone> {
  const bridge = windowsBridge();
  // Nothing moves under a carry in the hand.
  if (!bridge || carrying()) return "none";
  const [latest] = await bridge.undos();
  if (!latest) return "none";
  const entry = readUndo(latest.entry);
  if (entry) {
    // Whether it still applies, as the windows are now (a stale commit is tried again).
    let applies = true;
    const taken = await commitMove((seen) => {
      const back = undo(seen.arrangement, entry);
      applies = back !== null;
      return back;
    }, latest.id);
    if (taken) return "undone";
    // The windows kept changing under it: it stays, for the next press.
    if (applies) return "none";
  }
  bridge.dropUndo(latest.id);
  return "forgotten";
}
