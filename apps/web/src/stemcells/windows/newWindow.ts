/** Move Tab to New Window (⌥⌘T): the tab tears off into a window just down and right of this one. */
import { flushStoreWrites } from "../upstream/sharedStores";
import { randomUUID } from "../upstream/ui";
import {
  clampFrame,
  displayOf,
  windowById,
  type Display,
  type Moved,
  type Rect,
} from "./arrangement";
import { windowsBridge } from "./bridge";
import { tear } from "./moves";
import { commitMove, readSnapshot, writeTransaction, type Seen } from "./wire";

/** How far a new window sits from the one it came from, down and right. */
export const CASCADE = 24;

/** A window's frame cascaded from `frame`, kept on the display it lands on. */
export function cascaded(frame: Rect, displays: ReadonlyArray<Display>): Rect {
  const moved = { ...frame, x: frame.x + CASCADE, y: frame.y + CASCADE };
  const display = displayOf(moved, displays);
  return display ? clampFrame(moved, display.workArea) : moved;
}

/** `tabId` torn off window `source` into window `id` at `frame`, or cascaded from the source. */
function tearInto(
  { arrangement, displays }: Seen,
  source: string,
  tabId: string,
  frame: Rect | null,
  id: string,
): Moved | null {
  const from = windowById(arrangement, source);
  if (!from) return null;
  const at = frame ?? cascaded(from.frame, displays);
  const display = displayOf(at, displays)?.key ?? from.display;
  return tear(arrangement, tabId, { id, frame: at, display });
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
  const moved = await commitMove((seen) => tearInto(seen, bridge.boot.id, tabId, frame, id));
  return moved ? id : null;
}

/**
 * Starts, hidden, window `id` as tearing `tabId` off into it would open it
 * (stemcells/tasks/windows.md, The warm window): a drop in open space then
 * shows it drawn. It goes when the flight ends, unless that tear took it;
 * none starts once the carry no longer `wants` it.
 */
export async function warmNewWindow(
  tabId: string,
  frame: Rect,
  id: string,
  wants: () => boolean,
): Promise<void> {
  const bridge = windowsBridge();
  if (!bridge) return;
  // It starts from the drafts as typed a moment ago.
  flushStoreWrites();
  const seen = readSnapshot(await bridge.snapshot());
  const moved = tearInto(seen, bridge.boot.id, tabId, frame, id);
  if (moved && wants()) bridge.warm(writeTransaction(moved.transaction, seen.versions));
}

/** Tears `tabId` off this window into a new one. False when it can't (its only tab). */
export async function moveTabToNewWindow(tabId: string): Promise<boolean> {
  return (await tearToNewWindow(tabId, null)) !== null;
}
