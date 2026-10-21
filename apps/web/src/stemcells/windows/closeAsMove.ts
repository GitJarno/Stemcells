/**
 * A window the person closes closes as a move (stemcells/tasks/windows.md,
 * Undo Move): Aski's tab goes home to the lead in the same step, and Undo
 * Move can reopen the window with its tabs.
 */
import { windowsBridge } from "./bridge";
import { closeWindow } from "./moves";
import { commitMove } from "./wire";

/** Closes this window as a move; false when it can't (the desktop app then closes it as before). */
export async function closeThisWindow(): Promise<boolean> {
  const bridge = windowsBridge();
  if (!bridge) return false;
  const id = bridge.boot.id;
  return (await commitMove(({ arrangement }) => closeWindow(arrangement, id))) !== null;
}
