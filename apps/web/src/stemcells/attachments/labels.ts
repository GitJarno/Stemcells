/**
 * A person's word for an attachment: "Image 2", "Video 1" (numbered by kind within one message or
 * draft; a camera's file name says nothing the thumbnail doesn't), or a file's own name. The model
 * still gets real names. Free of the DOM: the phone reads it (`apps/mobile/src/stemcells/attachments/kit.ts`).
 */
export type AttachmentKind = "image" | "video" | "file";

export interface KindedAttachment {
  readonly id: string;
  readonly name: string;
  /** Null for one that never shows as itself (an annotated preview's screenshot): no number. */
  readonly kind: AttachmentKind | null;
}

const NOUNS = { image: "Image", video: "Video" } as const;

/** Each attachment's label, by its id. */
export function attachmentLabels(
  attachments: Iterable<KindedAttachment>,
): ReadonlyMap<string, string> {
  const counts = { image: 0, video: 0 };
  const labels = new Map<string, string>();
  for (const { id, name, kind } of attachments) {
    if (kind === null || labels.has(id)) continue;
    labels.set(id, kind === "file" ? name : `${NOUNS[kind]} ${(counts[kind] += 1)}`);
  }
  return labels;
}
