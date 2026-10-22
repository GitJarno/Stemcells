// Replaces `components/chat/MessagesTimeline.tsx` (`plugin.ts`): the work
// verbs read the chat's turns, and the cards of messages between Cells
// their exchange, from the entries the timeline draws, so the timeline hands
// them to its rows in our context (`TurnVerbsProvider`,
// `PeerExchangeProvider`), not in upstream's shared row state.
import type { ComponentProps } from "react";

import { MessagesTimeline as UpstreamMessagesTimeline } from "../../../components/chat/MessagesTimeline";
import { PeerExchangeProvider } from "../../peers/PeerExchange";
import { TurnVerbsProvider } from "../../verbs/WorkWord";

export * from "../../../components/chat/MessagesTimeline";

export function MessagesTimeline(props: ComponentProps<typeof UpstreamMessagesTimeline>) {
  return (
    <TurnVerbsProvider entries={props.timelineEntries}>
      <PeerExchangeProvider entries={props.timelineEntries}>
        <UpstreamMessagesTimeline {...props} />
      </PeerExchangeProvider>
    </TurnVerbsProvider>
  );
}
