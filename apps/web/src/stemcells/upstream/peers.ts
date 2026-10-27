/**
 * What messages between Cells take from upstream's chat (stemcells/tasks/peers.md, decision 4):
 * the row context every timeline row reads (environment, opening another chat, find, going back
 * to a turn), a thread's shell, the markdown a message is drawn in and when a long one folds, and
 * its row's time and copy.
 */
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type EnvironmentId, ThreadId } from "@t3tools/contracts";

import type { TimelineRow } from "../../components/chat/timelineRowContext";
import { useQuietThreadShell } from "../../state/entities";

export type { ThreadId } from "@t3tools/contracts";
export { default as ChatMarkdown } from "../../components/ChatMarkdown";
export { findRevealRef } from "../../components/chat/markdownFindContext";
export { MessageCopyButton } from "../../components/chat/MessageCopyButton";
export { MessageAuthorHeading } from "../../components/chat/TimelineRowParts";
export { shouldCollapseUserMessage } from "../../components/chat/MessagesTimeline.logic";
export { TimelineRowActivityCtx, TimelineRowCtx } from "../../components/chat/timelineRowContext";
export { formatChatTimestampTooltip, formatDayAwareTimestamp } from "../../timestampFormat";

/** A message's row in the timeline. */
export type MessageRow = Extract<TimelineRow, { kind: "message" }>;

/** Another Cell's chat, as a message from it names it. */
export interface PeerShell {
  readonly title: string;
  readonly providerInstanceId: string;
  readonly parentThreadId: string | null;
}

/** A thread's id, as upstream's thread links take it. */
export const threadIdOf = (id: string): ThreadId => ThreadId.make(id);

/** The shell of thread `threadId` in the environment, held through streaming ticks; null until known. */
export function usePeerShell(environmentId: EnvironmentId, threadId: string): PeerShell | null {
  const shell = useQuietThreadShell(scopeThreadRef(environmentId, ThreadId.make(threadId)));
  return shell === null
    ? null
    : {
        title: shell.title,
        providerInstanceId: shell.providerInstanceId,
        parentThreadId: shell.lineage.parentThreadId,
      };
}
