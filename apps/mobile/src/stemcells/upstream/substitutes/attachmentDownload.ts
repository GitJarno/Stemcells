// Replaces `lib/attachmentDownload.ts` (`substitutes.cjs`): every Share of a host file shows its
// download on the app's one card, with a Cancel, and an unchanged file isn't downloaded twice
// (`share/downloads.ts`).
import type * as Upstream from "../../../lib/attachmentDownload";
import { downloadAndShareAttachment as shareWithProgress } from "../../share/downloads";

export * from "../../../lib/attachmentDownload";

export function downloadAndShareAttachment(
  input: Parameters<typeof Upstream.downloadAndShareAttachment>[0],
): ReturnType<typeof Upstream.downloadAndShareAttachment> {
  return shareWithProgress(input);
}
