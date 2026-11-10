// Replaces `components/chat/TimelineAssistantRows.tsx` (`plugin.ts`): the row that draws an
// assistant's reply says so in our context, so the markdown inside it (`ChatMarkdown.tsx`) can
// draw the reply's close-out as a card (`closeOut/CloseOutCard.tsx`). All else is upstream's.
import type { ComponentProps } from "react";

import { AssistantTimelineRow as UpstreamAssistantTimelineRow } from "../../../components/chat/TimelineAssistantRows";
import { ReplyInView } from "../../closeOut/reply";

export * from "../../../components/chat/TimelineAssistantRows";

export function AssistantTimelineRow(props: ComponentProps<typeof UpstreamAssistantTimelineRow>) {
  const { message, showAssistantMeta } = props.row;
  return (
    <ReplyInView value={{ text: message.text, runId: message.runId, last: showAssistantMeta }}>
      <UpstreamAssistantTimelineRow {...props} />
    </ReplyInView>
  );
}
