// What a sent message's pictures take from upstream on the phone: its attachments and drafts,
// the server's copy and its cache key, the viewer and the spinner. A pending picture's
// `uploadedAttachmentId` is its sent attachment's id (upstream's `attachmentUpload.test.ts`).

export type { ChatAttachment, EnvironmentId } from "@t3tools/contracts";
export type { DraftComposerAttachment } from "../../lib/composerImages";
export { composerImageGallery } from "../../lib/composerImageGallery";
export { assetImageSource } from "../../lib/assetImageSource";
export { useAssetUrl, useRefreshAssetUrl } from "../../state/assets";
export { useFilePreviewGallery } from "../../components/FilePreviewGallery";
export type { FilePreviewItem, FilePreviewSource } from "../../components/FilePreviewModal.types";
export { PresentationSource } from "../../components/ui/NativePresentation";
export { AppActivityIndicator } from "../../components/ui/AppActivityIndicator";
