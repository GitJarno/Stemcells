/**
 * Undo Move (⌥⌘Z, stemcells/tasks/windows.md): takes the latest move between windows back,
 * while what it moved is still where it put it and no chat it would bring back is open
 * elsewhere. The latest goes back, or if it can't, is forgotten and nothing changes; a press
 * never reaches an older move, and does nothing while a carry is in the hand.
 */
import { windowsBridge } from "./bridge";
import { carrying } from "./carrying";
import { undo, type Refusal } from "./moves";
import { commitMove, readUndo } from "./wire";

/** What a press did: took the latest move back, found none, or forgot it and why. */
export type Undone = "undone" | "none" | Refusal;

export async function undoMove(): Promise<Undone> {
  const bridge = windowsBridge();
  // Nothing moves under a carry in the hand.
  if (!bridge || carrying()) return "none";
  const [latest] = await bridge.undos();
  if (!latest) return "none";
  const entry = readUndo(latest.entry);
  if (entry) {
    // Why it doesn't apply, as the windows are now (a stale commit is tried again).
    let refused = null as Refusal | null;
    const taken = await commitMove((seen) => {
      const back = undo(seen.arrangement, entry);
      refused = typeof back === "string" ? back : null;
      return typeof back === "string" ? null : back;
    }, latest.id);
    if (taken) return "undone";
    // The windows kept changing under it: it stays, for the next press.
    if (refused === null) return "none";
    bridge.dropUndo(latest.id);
    return refused;
  }
  // One kept by an older version of the app, which this one can't read.
  bridge.dropUndo(latest.id);
  return "changed";
}
