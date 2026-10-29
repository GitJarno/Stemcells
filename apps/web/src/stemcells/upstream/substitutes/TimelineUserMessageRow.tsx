// Replaces `components/chat/TimelineUserMessageRow.tsx` (`plugin.ts`): mail from another Cell is a
// card (`peers/PeerCard.tsx`) and a past collision notice a notice (`peers/CollisionRow.tsx`). All
// else is upstream's row, as is mail the card can't draw (a workflow's opening, an automation's
// run, one with attachments), its attachments labelled "Image 1", "Video 2" (`attachments/`).
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";
import { type ComponentProps, use } from "react";

import { UserMessageRow as UpstreamUserMessageRow } from "../../../components/chat/TimelineUserMessageRow";
import { TimelineRowCtx } from "../../../components/chat/timelineRowContext";
import { AttachmentLabels } from "../../attachments/AttachmentLabels";
import { CollisionRow } from "../../peers/CollisionRow";
import { collisionOf } from "../../peers/notice";
import { senderOf } from "../../peers/exchange";
import { PeerCard } from "../../peers/PeerCard";

export * from "../../../components/chat/TimelineUserMessageRow";

export function UserMessageRow(props: ComponentProps<typeof UpstreamUserMessageRow>) {
  const { message } = props.row;
  const ctx = use(TimelineRowCtx);
  const upstream = (
    <AttachmentLabels attachments={message.attachments}>
      <UpstreamUserMessageRow {...props} />
    </AttachmentLabels>
  );
  // A Cell's message is never a notice, whatever its id says: only the app's own has no sender.
  const sender = senderOf(message);
  if (sender !== null) {
    const plain =
      ctx.workflowOpening?.messageId !== message.id &&
      resolveUserMessagePresentation(message).attribution !== "automation" &&
      (message.attachments ?? []).length === 0;
    return plain ? <PeerCard row={props.row} sender={sender} /> : upstream;
  }
  const collision = message.role === "user" ? collisionOf(message.id) : null;
  if (collision !== null) return <CollisionRow message={message} collision={collision} />;
  return upstream;
}
