/**
 * The reel: every picture and video in a chat, in reading order, which the
 * viewer steps through. Built from the timeline the chat drew, not from the
 * page, as the timeline mounts only the rows near the screen.
 */
import {
  entryMedia,
  markdownMediaSources,
  type AssetResource,
  type ChatPlace,
  type MarkdownText,
  type MediaItem,
  type TimelineEntries,
} from "../upstream/media";

/** Where each attachment in a reel sits: its message, and its place there. */
const places = new WeakMap<MediaItem, string>();

/**
 * The names an item answers to: where it sits in the chat (an attachment's
 * message and place), the stored file it is (an asset), the URL it shows. A
 * thumbnail, a click and the reel each know some of these, so two items are
 * the same when any name matches; the first is the one that changes least.
 */
export function itemNames(item: MediaItem, resolvedSrc?: string | null): string[] {
  const names: string[] = [];
  const at = places.get(item);
  if (at) names.push(at);
  const resource = item.actionsSource?.asset?.resource;
  if (resource) names.push(assetName(resource));
  if (item.src) names.push(`src:${item.src}`);
  if (resolvedSrc && resolvedSrc !== item.src) names.push(`src:${resolvedSrc}`);
  return names;
}

function assetName(resource: AssetResource): string {
  switch (resource._tag) {
    case "attachment":
      return `attachment:${resource.attachmentId}`;
    case "media-file":
    case "workspace-file":
      return `${resource._tag}:${resource.threadId}:${resource.path}`;
    case "tool-output-image":
      return `tool-output-image:${resource.threadId}:${resource.itemId}:${resource.index}`;
    default:
      return `${resource._tag}:${JSON.stringify(resource)}`;
  }
}

export function sameItem(a: MediaItem, b: MediaItem): boolean {
  const names = new Set(itemNames(a));
  return itemNames(b).some((name) => names.has(name));
}

/** The item's first name: what the viewer keeps to find its place again as the reel grows. */
export function itemKey(item: MediaItem): string {
  return itemNames(item)[0] ?? `name:${item.name}`;
}

/** The media a settled text embeds; a text a Cell is still writing embeds none yet. */
export function settledSources(text: MarkdownText): readonly string[] {
  return text.settled ? markdownMediaSources(text.markdown) : [];
}

/**
 * Remembers each message's markdown media by the message, so a chat that
 * streams doesn't parse its messages again on every token. A message still
 * streaming isn't read until it settles; one whose text changes is read
 * again, in its one place. `settle` forgets messages the last reel didn't
 * read (reverted away).
 */
export class MarkdownSources {
  readonly #parse: (markdown: string) => readonly string[];
  readonly #byId = new Map<
    string,
    { readonly markdown: string; readonly sources: readonly string[] }
  >();
  readonly #read = new Set<string>();

  constructor(parse: (markdown: string) => readonly string[] = markdownMediaSources) {
    this.#parse = parse;
  }

  readonly of = (text: MarkdownText): readonly string[] => {
    if (!text.settled) return [];
    this.#read.add(text.id);
    const known = this.#byId.get(text.id);
    if (known?.markdown === text.markdown) return known.sources;
    const sources = this.#parse(text.markdown);
    this.#byId.set(text.id, { markdown: text.markdown, sources });
    return sources;
  };

  settle(): void {
    for (const id of this.#byId.keys()) {
      if (!this.#read.has(id)) this.#byId.delete(id);
    }
    this.#read.clear();
  }
}

/** The chat's media in reading order, each item once, at its first place. */
export function chatReel(
  entries: TimelineEntries,
  place: ChatPlace,
  pictureUrl: (attachmentId: string) => string | undefined,
  sources: (text: MarkdownText) => readonly string[] = settledSources,
): MediaItem[] {
  const reel: MediaItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const { item, at } of entryMedia(entry, place, pictureUrl, sources)) {
      if (at) places.set(item, at);
      const names = itemNames(item);
      if (names.some((name) => seen.has(name))) continue;
      names.forEach((name) => seen.add(name));
      reel.push(item);
    }
  }
  return reel;
}

/**
 * What the viewer steps through around the item showing now: the chat's
 * reel when it holds the item; else the list its click came with (the
 * composer's pictures, a tool's output); else the item on its own (its
 * message was reverted away). Found by the item, never by an index, so a
 * reel that changes under the viewer never puts another picture up.
 */
export function reelAround(
  showing: MediaItem,
  reel: readonly MediaItem[],
  own: readonly MediaItem[],
): { readonly items: readonly MediaItem[]; readonly index: number } {
  for (const items of [reel, own]) {
    const index = items.findIndex((item) => sameItem(item, showing));
    if (index >= 0) return { items, index };
  }
  return { items: [showing], index: 0 };
}

/** Where the viewer stands: the item showing, and how many steps it took to reach it. */
export interface Standing {
  readonly item: MediaItem;
  readonly step: number;
}

/**
 * The viewer's place after the reel changed under it (it streamed, a URL
 * was re-signed, a message was reverted): found again by the item showing,
 * on the same step, so nothing on screen starts over. The standing comes
 * back as it was unless the reel knows the item by a newer first name (its
 * stored file, its message's place), whose copy it then keeps.
 */
export function restand(
  standing: Standing,
  reel: readonly MediaItem[],
  own: readonly MediaItem[],
): { readonly items: readonly MediaItem[]; readonly index: number; readonly standing: Standing } {
  const { items, index } = reelAround(standing.item, reel, own);
  const item = items[index] ?? standing.item;
  const fresher = itemKey(item) !== itemKey(standing.item);
  return { items, index, standing: fresher ? { item, step: standing.step } : standing };
}
