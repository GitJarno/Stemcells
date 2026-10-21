// Replaces `components/chat/ComposerStashBadge.tsx` (`plugin.ts`): in a
// Cell's pane whose line shows, the stash sits at the right end of the
// Cell's ledge (`composer/LineStash.tsx`), on the same row as its name,
// never a tab of its own between the line and the box. Where no line shows
// (a draft, Aski's pane, upstream's own routes) it is upstream's tab.
import { type ComponentProps, memo, use } from "react";
import { createPortal } from "react-dom";

import { ComposerStashBadge as UpstreamStashBadge } from "../../../components/chat/ComposerStashBadge";
import { LineStash } from "../../composer/LineStash";
import { ComposerStashSlot } from "../../composer/slot";

export * from "../../../components/chat/ComposerStashBadge";

export const ComposerStashBadge = memo(function ComposerStashBadge(
  props: ComponentProps<typeof UpstreamStashBadge>,
) {
  const slot = use(ComposerStashSlot)?.element ?? null;
  if (slot === null) return <UpstreamStashBadge {...props} />;
  return props.count === 0 ? null : createPortal(<LineStash {...props} />, slot);
});
