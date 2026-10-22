/** Move Tab to New Window (⌥⌘T): the tab tears off into a window just down and right of this one. */
import { randomUUID } from "../upstream/ui";
import { clampFrame, displayOf, windowById, type Display, type Rect } from "./arrangement";
import { windowsBridge } from "./bridge";
import { tear } from "./moves";
import { commitMove } from "./wire";

/** How far a new window sits from the one it came from, down and right. */
export const CASCADE = 24;

/** A window's frame cascaded from `frame`, kept on the display it lands on. */
export function cascaded(frame: Rect, displays: ReadonlyArray<Display>): Rect {
  const moved = { ...frame, x: frame.x + CASCADE, y: frame.y + CASCADE };
  const display = displayOf(moved, displays);
  return display ? clampFrame(moved, display.workArea) : moved;
}

/**
 * Tears `tabId` off this window into a new one at `frame`, or cascaded from
 * this one. The new window's id; null when it can't (its only tab).
 */
export async function tearToNewWindow(
  tabId: string,
  frame: Rect | null,
  id: string = randomUUID(),
): Promise<string | null> {
  const bridge = windowsBridge();
  if (!bridge) return null;
  const moved = await commitMove(({ arrangement, displays }) => {
    const source = windowById(arrangement, bridge.boot.id);
    if (!source) return null;
    const at = frame ?? cascaded(source.frame, displays);
    const display = displayOf(at, displays)?.key ?? source.display;
    return tear(arrangement, tabId, { id, frame: at, display });
  });
  return moved ? id : null;
}

/** Tears `tabId` off this window into a new one. False when it can't (its only tab). */
export async function moveTabToNewWindow(tabId: string): Promise<boolean> {
  return (await tearToNewWindow(tabId, null)) !== null;
}
