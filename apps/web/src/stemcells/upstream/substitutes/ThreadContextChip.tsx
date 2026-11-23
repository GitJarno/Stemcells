/**
 * Replaces `components/ThreadContextChip.tsx` (`plugin.ts`): a thread chip opens its chat in a
 * new pane beside its own, so the chat being read stays on screen, where upstream's route fills
 * the focused pane. A click with a modifier, or outside the workspace, does what upstream's does.
 */
import type { ComponentProps, MouseEvent } from "react";

import { ThreadContextChip as UpstreamThreadContextChip } from "../../../components/ThreadContextChip";
import { openCellBeside } from "../../tabs/commands";

export * from "../../../components/ThreadContextChip";

export function ThreadContextChip(props: ComponentProps<typeof UpstreamThreadContextChip>) {
  const onClickCapture = (event: MouseEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!(event.target instanceof Element) || !event.target.closest("a")) return;
    const { environmentId, threadId } = props.record;
    // Upstream's link stands down on a click already handled.
    if (openCellBeside({ environmentId, threadId, draftId: null })) event.preventDefault();
  };
  return (
    <span className="contents" onClickCapture={onClickCapture}>
      <UpstreamThreadContextChip {...props} />
    </span>
  );
}
