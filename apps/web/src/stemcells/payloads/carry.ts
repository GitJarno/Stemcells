/**
 * Starting a carry: a picture, video or file picked up by dragging it, written onto the browser's
 * drag (`wire.ts`). The window it starts in keeps the bytes it holds (a composer's chip) for a
 * drop there, and lends a blob URL of each to a drop in another of the app's windows, until its
 * next carry.
 */
import { newId, THREAD_ROW } from "../upstream/payloads";
import type { Shown } from "./payload";
import { CARRIED_TYPE, encodeCarried } from "./wire";

/** What the browser's drag start gives: its data, and the element picked up. */
export interface DragStart {
  readonly dataTransfer: Pick<DataTransfer, "clearData" | "setData" | "effectAllowed">;
  readonly currentTarget: EventTarget;
}

export interface Pickup {
  readonly items: ReadonlyArray<Shown>;
  /** Bytes the page holds, by item: a drop in this window takes them as they are. */
  readonly files?: ReadonlyArray<File | null>;
  /** A composer's chip, by its chat's key (`chatKeyOf`): that chat takes nothing, as it has it. */
  readonly fromChat?: string;
  /** Where the browser can download the first item, for a drop outside the app. */
  readonly downloadUrl?: string | null;
}

interface Holding {
  readonly drag: string;
  readonly source: EventTarget;
  readonly files: ReadonlyArray<File | null>;
  readonly fromChat: string | null;
}

let holding: Holding | null = null;
let lent: string[] = [];

// The app's windows share their storage and nothing else does, so a drag a web page dresses as
// a carry, naming any address or file, is never read.
const STARTED_KEY = "stemcells:carry:started";
const STARTED_KEPT = 8;

function startedDrags(): ReadonlyArray<string> {
  try {
    const kept: unknown =
      typeof localStorage === "undefined"
        ? []
        : JSON.parse(localStorage.getItem(STARTED_KEY) ?? "[]");
    return Array.isArray(kept) ? kept.filter((drag) => typeof drag === "string") : [];
  } catch {
    return [];
  }
}

function markStarted(drag: string): void {
  try {
    const kept = [drag, ...startedDrags()].slice(0, STARTED_KEPT);
    localStorage.setItem(STARTED_KEY, JSON.stringify(kept));
  } catch {
    // Storage refused: the carry holds in its own window alone.
  }
}

/** Whether one of the app's windows started the carry `drag`. */
export function startedInApp(drag: string): boolean {
  return holding?.drag === drag || startedDrags().includes(drag);
}

export function startCarry(event: DragStart, pickup: Pickup): void {
  const drag = newId();
  for (const url of lent) URL.revokeObjectURL(url);
  lent = [];
  const items = pickup.items.map((item, index) => {
    const file = pickup.files?.[index] ?? null;
    if (file === null) return item;
    const url = URL.createObjectURL(file);
    lent.push(url);
    return { ...item, url };
  });
  const transfer = event.dataTransfer;
  // A picture's own drag brings its address and markup, which an editor under the drop would
  // type in; the carry is the drag's only content in the page.
  transfer.clearData();
  transfer.setData(CARRIED_TYPE, encodeCarried({ version: 1, drag, items }));
  const download = downloadUrlOf(items[0], pickup.downloadUrl ?? null);
  if (download !== null) transfer.setData("DownloadURL", download);
  transfer.effectAllowed = "copy";

  markStarted(drag);
  holding = {
    drag,
    source: event.currentTarget,
    files: pickup.files ?? [],
    fromChat: pickup.fromChat ?? null,
  };
  event.currentTarget.addEventListener(
    "dragend",
    () => {
      if (holding?.drag === drag) holding = null;
    },
    { once: true },
  );
}

/**
 * Whether a chat at `target` refuses this window's carry: a chip never goes back into its own
 * chat, whether it's let go over that chat or over its row in the sidebar.
 */
export function refusedBy(target: { contains(node: Node | null): boolean }): boolean {
  if (holding === null || holding.fromChat === null) return false;
  if (holding.source instanceof Node && target.contains(holding.source)) return true;
  return target instanceof Element && target.getAttribute(THREAD_ROW) === holding.fromChat;
}

/** The bytes this window holds for the carry `drag`, by item; none for another window's. */
export function heldFor(drag: string): ReadonlyArray<File | null> {
  return holding?.drag === drag ? holding.files : [];
}

/** Chrome's "type:name:url", which a drop on the desktop saves as the file; web addresses only. */
function downloadUrlOf(item: Shown | undefined, url: string | null): string | null {
  if (item === undefined || url === null || !/^https?:\/\//i.test(url)) return null;
  const type = item.mimeType ?? "application/octet-stream";
  return `${type}:${item.name.replaceAll(":", "_")}:${url}`;
}
