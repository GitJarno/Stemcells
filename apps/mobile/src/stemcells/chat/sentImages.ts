// A user message's pictures, as one row from the tap of Send to the sent message. While the
// message is pending they're the drafts this phone picked; once the server holds it, its
// attachments, which keep showing this phone's own files for what it sent this session.

import { imageMimeType } from "@t3tools/shared/image";

import type { ChatAttachment, DraftComposerAttachment } from "../upstream/messageImages";

export interface SentImage {
  /** Its place in the row, the same while pending and once sent, so its tile stays mounted. */
  readonly key: string;
  /** Its id among its message's attachments, or its draft's while pending. */
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  /** The server's copy, once uploaded. */
  readonly attachmentId: string | null;
  /** This phone's own file of it, shown until the server's copy has loaded. */
  readonly localUri: string | null;
  /** The draft it was sent from, while the message is pending. */
  readonly draft: DraftComposerAttachment | null;
}

interface Attached {
  readonly type: string;
  readonly name: string;
  readonly mimeType: string;
}

function isPicture(attachment: Attached) {
  return attachment.type === "image" || imageMimeType(attachment) !== null;
}

/** What upstream's rows still draw: everything but the pictures, which `MessageImages` draws. */
export function withoutPictures<A extends Attached>(
  attachments: ReadonlyArray<A> | undefined,
): ReadonlyArray<A> {
  return attachments?.filter((attachment) => !isPicture(attachment)) ?? [];
}

// The last pictures this phone sent. A pasted picture's inline data runs to megabytes, so its
// sent message loads it from the server instead.
const REMEMBERED_MAX = 64;
const remembered = new Map<string, string>();

function rememberedKey(environmentId: string, attachmentId: string) {
  return JSON.stringify([environmentId, attachmentId]);
}

/** Keeps each uploaded picture's own file, for its sent message to show. */
export function rememberSentImages(environmentId: string, images: ReadonlyArray<SentImage>) {
  for (const image of images) {
    if (image.attachmentId === null || image.localUri === null) continue;
    if (image.localUri.startsWith("data:")) continue;
    const key = rememberedKey(environmentId, image.attachmentId);
    remembered.delete(key);
    remembered.set(key, image.localUri);
  }
  for (const key of remembered.keys()) {
    if (remembered.size <= REMEMBERED_MAX) break;
    remembered.delete(key);
  }
}

export function sentImages(
  environmentId: string,
  attachments: ReadonlyArray<ChatAttachment>,
  pending: ReadonlyArray<DraftComposerAttachment>,
): SentImage[] {
  const sent = attachments.filter(isPicture);
  if (sent.length > 0) {
    return sent.map((attachment, index) => ({
      key: String(index),
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      attachmentId: attachment.id,
      localUri: remembered.get(rememberedKey(environmentId, attachment.id)) ?? null,
      draft: null,
    }));
  }
  return pending.filter(isPicture).map((draft, index) => ({
    key: String(index),
    id: draft.id,
    name: draft.name,
    mimeType: draft.mimeType,
    attachmentId:
      draft.uploadEnvironmentId === environmentId ? (draft.uploadedAttachmentId ?? null) : null,
    localUri: draft.type === "image" ? draft.previewUri : draft.fileUri,
    draft,
  }));
}
