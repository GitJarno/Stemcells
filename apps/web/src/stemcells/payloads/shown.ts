/**
 * What a chat shows, as something carried: a picture or video by the file
 * it names on its machine (signed afresh when it lands, since the URL the
 * chat shows it by expires), a picture from the web by its address, a file
 * a message holds by its attachment.
 */
import type { MediaItem } from "../upstream/media";
import type { Shown } from "./payload";

const PICTURE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** The picture type a name says, for media whose type nobody gave. */
function pictureTypeOfName(name: string): string | null {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return extension ? (PICTURE_TYPES[extension] ?? null) : null;
}

/** A picture or video the chat shows (what the media viewer shows); null when it names nothing that lasts. */
export function shownOfMedia(item: MediaItem): Shown | null {
  const asset = item.actionsSource?.asset ?? null;
  const web =
    item.originalUrl ?? (item.src !== null && /^https?:\/\//i.test(item.src) ? item.src : null);
  // A picture still sending is a copy in the page the server doesn't know yet.
  if (asset === null && web === null) return null;
  const kind = item.type === "video" ? "video" : "image";
  return {
    name: item.name,
    kind,
    mimeType: item.mimeType ?? (kind === "image" ? pictureTypeOfName(item.name) : null),
    sizeBytes: null,
    asset: asset ? { environmentId: asset.environmentId, resource: asset.resource } : null,
    url: asset ? null : web,
  };
}

/** A file a message holds, on the machine of the chat it was sent in. */
export function shownOfAttachment(
  environmentId: string,
  attachment: {
    readonly id: string;
    readonly name: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
  },
): Shown {
  return {
    name: attachment.name,
    kind: attachment.mimeType.startsWith("video/") ? "video" : "file",
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    asset: { environmentId, resource: { _tag: "attachment", attachmentId: attachment.id } },
    url: null,
  };
}
