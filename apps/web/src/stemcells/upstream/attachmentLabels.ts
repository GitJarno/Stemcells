/**
 * What an attachment's label takes from upstream: which attachments it draws as a picture, a
 * video or a file, and the chip it draws them in (`stemcells/tasks/attachment-labels.md`).
 * `attachmentLabels.contract.test.ts` pins the kinds.
 */
import {
  type ChatAttachment,
  isFileAttachment,
  isImageAttachment,
  isVideoAttachment,
} from "../../types";
import { attachmentLabels, type AttachmentKind } from "../attachments/labels";

export { ContextChip, ContextChipLabel } from "../../components/ContextChip";
export { Tooltip, TooltipPopup, TooltipTrigger } from "../../components/ui/tooltip";
export type { ChatAttachment };

/** An attachment's label: "Image 2", "Video 1", or a file's own name. */
export type Labeller = (attachment: { readonly id: string; readonly name: string }) => string;

/**
 * Upstream's own split: a message's and a draft's pictures are tiles, its videos players, the
 * rest file rows. An annotated preview's screenshot shows inside its annotation, not as a tile.
 */
export function kindOf(attachment: ChatAttachment): AttachmentKind | null {
  if (isImageAttachment(attachment)) {
    return attachment.name.startsWith("preview-annotation-") ? null : "image";
  }
  return isFileAttachment(attachment) && isVideoAttachment(attachment) ? "video" : "file";
}

/** Labels within one message, or one draft (its pictures still being prepared last). */
export function attachmentLabeller(
  attachments: Iterable<ChatAttachment> | undefined,
  preparing: ReadonlyArray<{ readonly id: string; readonly name: string }> = [],
): Labeller {
  const labels = attachmentLabels([
    ...[...(attachments ?? [])].map((attachment) => ({ ...attachment, kind: kindOf(attachment) })),
    ...preparing.map((image) => ({ ...image, kind: "image" as const })),
  ]);
  return (attachment) => labels.get(attachment.id) ?? attachment.name;
}
