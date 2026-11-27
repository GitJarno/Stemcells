// What a chat's gallery takes from upstream on the phone: the feed's entries, a message's
// pictures and the pictures the agent viewed as the feed draws them, and a preview's identity.
// `gallery.contract.test.tsx` feeds it the feed's own shapes.

export type { EnvironmentId, ThreadId } from "@t3tools/contracts";
export {
  resolveViewedImageAsset,
  workEntryViewedImagePath,
} from "@t3tools/client-runtime/work-log/presentation";
export type {
  FilePreviewItem,
  FilePreviewSource,
} from "../../components/ui/FilePreviewModal.types";
export { messageImageGallery } from "../../features/threads/messageImageGallery";
export { filePreviewKey } from "../../lib/filePreviewGallery";
export { resolveMarkdownMediaPreview } from "../../lib/markdownMedia";
export type { ThreadFeedEntry } from "../../lib/threadActivity";
