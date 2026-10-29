// What an attachment's label takes from upstream on the phone: which attachments, and which of a
// message's or a draft's context records, it draws as a picture, a video or a file, as the web
// does (`apps/web/src/stemcells/upstream/attachmentLabels.ts`). The labels are the web's
// (`../attachments/kit.ts`); `attachments.test.ts` pins the chips' labels.

import type { ComposerContextRecord } from "@t3tools/contracts";
import { parseComposerContextHref } from "@t3tools/shared/composerContextReferences";
import { imageMimeType } from "@t3tools/shared/image";
import { videoMimeType } from "@t3tools/shared/video";

import { attachmentLabels, type AttachmentKind } from "../attachments/kit";

interface Attached {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly mimeType: string;
}

/** An attachment's label: "Image 2", "Video 1", or a file's own name. */
type Labeller = (attachment: { readonly id: string; readonly name: string }) => string;

/** An annotated preview's screenshot shows inside its annotation, so it takes no number. */
function kindOf(attachment: Attached): AttachmentKind | null {
  if (attachment.type === "image" || imageMimeType(attachment) !== null) {
    return attachment.name.startsWith("preview-annotation-") ? null : "image";
  }
  return attachment.type === "file" && videoMimeType(attachment) !== null ? "video" : "file";
}

/** Labels within one message's or one draft's attachments. */
export function attachmentLabeller(attachments: Iterable<Attached>): Labeller {
  const labels = attachmentLabels(
    [...attachments].map((attachment) => ({ ...attachment, kind: kindOf(attachment) })),
  );
  return (attachment) => labels.get(attachment.id) ?? attachment.name;
}

function attachedOf(record: ComposerContextRecord): Attached | null {
  if ("payload" in record || (record.kind !== "image" && record.kind !== "file")) return null;
  return { id: record.contextId, type: record.kind, name: record.name, mimeType: record.mimeType };
}

/**
 * A picture's or a video's chip label among its message's or draft's records ("Image 2"),
 * numbered as its tiles are: every attachment a message sends carries a record, in its order.
 * Undefined for any other chip, which keeps upstream's words.
 */
export function mediaChipLabel(
  record: ComposerContextRecord | undefined,
  records: ReadonlyArray<ComposerContextRecord> | undefined,
): string | undefined {
  const own = record === undefined ? null : attachedOf(record);
  const kind = own === null ? null : kindOf(own);
  if (own === null || (kind !== "image" && kind !== "video")) return undefined;
  return attachmentLabeller((records ?? []).flatMap((other) => attachedOf(other) ?? []))(own);
}

/** The same, for a chip drawn from its link in a message's text. */
export function mediaLinkLabel(
  href: string,
  records: ReadonlyArray<ComposerContextRecord> | undefined,
): string | undefined {
  const contextId = parseComposerContextHref(href)?.contextId;
  const record = records?.find((candidate) => candidate.contextId === contextId);
  return mediaChipLabel(record, records);
}
