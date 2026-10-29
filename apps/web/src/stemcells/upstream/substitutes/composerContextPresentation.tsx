/**
 * Replaces `components/composerContextPresentation.tsx` (`plugin.ts`): a picture's or a video's
 * chip in the composer reads "Image 1", "Video 2" (`attachments/MediaChip.tsx`), numbered across
 * the draft as its strip is, not its file's name, size and thumbnail. Every other chip is
 * upstream's, and so is a video to attach again: its name is how the person finds it.
 */
import { type ComponentProps, use } from "react";

import {
  ComposerContextActionsContext,
  ComposerContextRecordsContext,
  ComposerContextReferenceChip as UpstreamComposerContextReferenceChip,
} from "../../../components/composerContextPresentation";
import { composerFileNeedsReattach } from "../../../composerDraftStore";
import {
  type AttachmentUploadState,
  formatAttachmentUploadProgress,
} from "../../../lib/attachmentUploadState";
import { isVideoAttachment } from "../../../types";
import { MediaChip } from "../../attachments/MediaChip";
import { attachmentLabeller } from "../attachmentLabels";

export * from "../../../components/composerContextPresentation";

function uploadSuffix(upload: AttachmentUploadState | undefined): string | null {
  if (upload?.status === "uploading") return formatAttachmentUploadProgress(upload.progress);
  return upload?.status === "failed" ? "upload failed" : null;
}

export function ComposerContextReferenceChip(
  props: ComponentProps<typeof UpstreamComposerContextReferenceChip>,
) {
  const records = use(ComposerContextRecordsContext);
  const actions = use(ComposerContextActionsContext);
  const entry = records.get(props.contextId);
  const attached =
    entry?.kind === props.kind && (entry?.kind === "image" || entry?.kind === "file")
      ? entry
      : null;
  const media =
    attached?.kind === "image"
      ? ("image" as const)
      : attached !== null &&
          isVideoAttachment(attached.record) &&
          !composerFileNeedsReattach(attached.record)
        ? ("video" as const)
        : null;
  if (attached === null || media === null) {
    return <UpstreamComposerContextReferenceChip {...props} />;
  }
  const label = attachmentLabeller(
    [...records.values()].flatMap((other) =>
      other.kind === "image" || other.kind === "file" ? [other.record] : [],
    ),
  );
  const { record, upload } = attached;
  return (
    <MediaChip
      kind={media}
      label={label(record)}
      suffix={uploadSuffix(upload)}
      tooltip={upload?.status === "failed" ? upload.reason : null}
      failed={upload?.status === "failed"}
      onOpen={() =>
        media === "image" ? actions.expandImage(record.id) : actions.expandVideo(record.id)
      }
    />
  );
}
