// Replaces `lib/enrichedLinkPresentation.ts` (`substitutes.cjs`): a picture's or a video's chip in
// a message's text reads "Image 1", "Video 2" (`../attachments.ts`), as on the Mac, not its file's
// name and size. Every other chip is upstream's.
import type { ComposerContextRecord } from "@t3tools/contracts";

import { enrichedContextLinkPresentation as upstreamContextLinkPresentation } from "../../../lib/enrichedLinkPresentation";
import { mediaLinkLabel } from "../attachments";

export * from "../../../lib/enrichedLinkPresentation";

export function enrichedContextLinkPresentation(
  href: string,
  records?: ReadonlyArray<ComposerContextRecord>,
): ReturnType<typeof upstreamContextLinkPresentation> {
  const chip = upstreamContextLinkPresentation(href, records);
  const label = chip === undefined ? undefined : mediaLinkLabel(href, records);
  return chip === undefined || label === undefined ? chip : { ...chip, label };
}
