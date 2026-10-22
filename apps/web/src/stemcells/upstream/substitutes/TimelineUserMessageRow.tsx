// Replaces `components/chat/TimelineUserMessageRow.tsx` (`plugin.ts`): a
// message another Cell sent this one, here or from a linked machine, is mail
// it received, drawn as a card
// (`peers/PeerCard.tsx`), and a collision notice the app sent is a notice
// (`peers/CollisionRow.tsx`). Neither wears the person's bubble. Every other
// message is upstream's row (stemcells/tasks/peers.md, decision 4), and so
// is a Cell's message the card can't draw: a workflow's opening, an
// automation's run, or one with attachments.
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";
import { type ComponentProps, use } from "react";

import { UserMessageRow as UpstreamUserMessageRow } from "../../../components/chat/TimelineUserMessageRow";
import { TimelineRowCtx } from "../../../components/chat/timelineRowContext";
import { CollisionRow } from "../../peers/CollisionRow";
import { collisionOf } from "../../peers/notice";
import { senderOf } from "../../peers/exchange";
import { PeerCard } from "../../peers/PeerCard";

export * from "../../../components/chat/TimelineUserMessageRow";

export function UserMessageRow(props: ComponentProps<typeof UpstreamUserMessageRow>) {
  const { message } = props.row;
  const ctx = use(TimelineRowCtx);
  // A Cell's message is never a notice, whatever its id says: only the app's own has no sender.
  const sender = senderOf(message);
  if (sender !== null) {
    const plain =
      ctx.workflowOpening?.messageId !== message.id &&
      resolveUserMessagePresentation(message).attribution !== "automation" &&
      (message.attachments ?? []).length === 0;
    return plain ? (
      <PeerCard row={props.row} sender={sender} />
    ) : (
      <UpstreamUserMessageRow {...props} />
    );
  }
  const collision = message.role === "user" ? collisionOf(message.id) : null;
  if (collision !== null) return <CollisionRow message={message} collision={collision} />;
  return <UpstreamUserMessageRow {...props} />;
}
