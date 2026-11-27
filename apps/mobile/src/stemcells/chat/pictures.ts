// A chat's pictures, in the order its feed draws them, for the full-screen viewer to page
// through: each message's (attached, then embedded), and each picture the agent viewed. Upstream
// pages through the tapped message's own pictures only.

import {
  type EnvironmentId,
  type FilePreviewItem,
  type FilePreviewSource,
  filePreviewKey,
  messageImageGallery,
  resolveMarkdownMediaPreview,
  resolveViewedImageAsset,
  type ThreadFeedEntry,
  type ThreadId,
  workEntryViewedImagePath,
} from "../upstream/gallery";

export interface ChatPlace {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly workspaceRoot: string | null | undefined;
}

/** Pages either side of the tapped one: each resolves its URL as the viewer opens. */
export const GALLERY_REACH = 25;

/** Every picture in the chat, in feed order, each once, at its first place. */
export function chatGallery(
  feed: ReadonlyArray<ThreadFeedEntry>,
  place: ChatPlace,
): FilePreviewItem[] {
  const seen = new Set<string>();
  const items: FilePreviewItem[] = [];
  const add = (item: FilePreviewItem) => {
    const key = filePreviewKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };
  for (const entry of feed) {
    if (entry.type === "message") {
      messageImageGallery(entry.message, place).forEach(add);
    } else if (entry.type === "activity-group") {
      for (const activity of entry.activities) {
        const path = workEntryViewedImagePath(activity.workEntry);
        const viewed = path === null ? null : viewedImage(path, place);
        if (viewed) add(viewed);
      }
    }
  }
  return items;
}

/** A picture the agent opened, as the feed's viewed-image row draws and opens it. */
function viewedImage(path: string, place: ChatPlace): FilePreviewItem | null {
  const viewed = resolveViewedImageAsset(path, place);
  if (viewed === null) return null;
  const media = resolveMarkdownMediaPreview(path, { ...place, imageEmbed: true });
  const actions = media?.source.actionsSource;
  return {
    kind: "image",
    name: viewed.alt,
    environmentId: place.environmentId,
    resource: viewed.resource,
    ...(viewed.srcFragment ? { srcFragment: viewed.srcFragment } : {}),
    ...(actions && "resource" in actions
      ? { actionsSource: { ...actions, resource: viewed.resource } }
      : {}),
  };
}

/**
 * The pages a tapped picture opens among: the chat's, up to `reach` either side of it. Null when
 * the chat doesn't hold it (a picture still sending), which keeps upstream's own list.
 */
export function galleryAround(
  source: FilePreviewSource,
  chat: ReadonlyArray<FilePreviewItem>,
  reach = GALLERY_REACH,
): FilePreviewItem[] | null {
  if (source.kind !== "image") return null;
  const key = filePreviewKey(source);
  const index = chat.findIndex((item) => filePreviewKey(item) === key);
  if (index < 0) return null;
  return chat.slice(Math.max(0, index - reach), index + reach + 1);
}
