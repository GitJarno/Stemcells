// Replaces `components/chat/MessagesTimeline.tsx` (`plugin.ts`): the work
// verbs read the chat's turns from the entries the timeline draws, so the
// timeline hands them to its rows in our context (`TurnVerbsProvider`), not
// in upstream's shared row state.
import type { ComponentProps } from "react";

import { MessagesTimeline as UpstreamMessagesTimeline } from "../../../components/chat/MessagesTimeline";
import { TurnVerbsProvider } from "../../verbs/WorkWord";

export * from "../../../components/chat/MessagesTimeline";

export function MessagesTimeline(props: ComponentProps<typeof UpstreamMessagesTimeline>) {
  return (
    <TurnVerbsProvider entries={props.timelineEntries}>
      <UpstreamMessagesTimeline {...props} />
    </TurnVerbsProvider>
  );
}
