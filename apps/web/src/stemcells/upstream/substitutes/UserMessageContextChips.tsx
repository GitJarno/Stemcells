/**
 * Replaces `components/chat/UserMessageContextChips.tsx` (`plugin.ts`): a picture's or a video's
 * chip in a sent message reads "Image 1", "Video 2" (`attachments/MediaChip.tsx`), as its tile
 * over the words does, not its file's name, size and thumbnail. The labels come from the row
 * (`TimelineUserMessageRow.tsx` here); every other chip is upstream's.
 */
import type { ComposerContextId } from "@t3tools/contracts";
import { formatComposerContextReference } from "@t3tools/shared/composerContextReferences";
import type { ComponentProps } from "react";

import { UserMessageContextReferenceChip as UpstreamUserMessageContextReferenceChip } from "../../../components/chat/UserMessageContextChips";
import { isImageAttachment, isVideoAttachment } from "../../../types";
import { useAttachmentLabels } from "../../attachments/AttachmentLabels";
import { MediaChip } from "../../attachments/MediaChip";

export * from "../../../components/chat/UserMessageContextChips";

export function UserMessageContextReferenceChip(
  props: ComponentProps<typeof UpstreamUserMessageContextReferenceChip>,
) {
  const label = useAttachmentLabels();
  const { record, attachment, reference } = props;
  const copyMarkdown = formatComposerContextReference({
    kind: reference.kind,
    contextId: reference.contextId as ComposerContextId,
    label: reference.label,
  });
  if (record?.kind === "image" && attachment !== null && isImageAttachment(attachment)) {
    return (
      <MediaChip
        kind="image"
        label={label(attachment)}
        copyMarkdown={copyMarkdown}
        onOpen={() => props.onExpandImage(attachment)}
      />
    );
  }
  if (record?.kind === "file" && attachment?.type === "file" && isVideoAttachment(attachment)) {
    return (
      <MediaChip
        kind="video"
        label={label(attachment)}
        disabled={attachment.downloadable === false && attachment.previewUrl === undefined}
        copyMarkdown={copyMarkdown}
        onOpen={() => props.onExpandVideo(attachment)}
      />
    );
  }
  return <UpstreamUserMessageContextReferenceChip {...props} />;
}
