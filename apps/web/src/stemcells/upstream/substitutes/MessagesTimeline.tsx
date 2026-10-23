// Replaces `components/chat/MessagesTimeline.tsx` (`plugin.ts`): the work
// verbs read the chat's turns, and the cards of messages between Cells
// their exchange, from the entries the timeline draws, so the timeline hands
// them to its rows in our context (`TurnVerbsProvider`,
// `PeerExchangeProvider`), not in upstream's shared row state. And while
// upstream's list follows its end, a mark in its footer tells the pane, which
// keeps the end in the same frame through the transcript's height
// (`tabs/keepEnd.ts`). Only a timeline with entries is marked: an empty one
// with no footer draws upstream's empty state. It also hands what it draws to
// the chat's media viewer (`media/chatEntries.ts`).
import type { ComponentProps } from "react";

import { MessagesTimeline as UpstreamMessagesTimeline } from "../../../components/chat/MessagesTimeline";
import { usePublishChatEntries } from "../../media/chatEntries";
import { PeerExchangeProvider } from "../../peers/PeerExchange";
import { TurnVerbsProvider } from "../../verbs/WorkWord";

export * from "../../../components/chat/MessagesTimeline";

export function MessagesTimeline(props: ComponentProps<typeof UpstreamMessagesTimeline>) {
  usePublishChatEntries(props.routeThreadKey, props.timelineEntries);
  return (
    <TurnVerbsProvider entries={props.timelineEntries}>
      <PeerExchangeProvider entries={props.timelineEntries}>
        <UpstreamMessagesTimeline
          {...props}
          footer={
            props.liveFollowEnabled &&
            props.anchorMessageId === null &&
            props.timelineEntries.length > 0 ? (
              <>
                {props.footer}
                <i hidden data-stemcells-follows="" />
              </>
            ) : (
              props.footer
            )
          }
        />
      </PeerExchangeProvider>
    </TurnVerbsProvider>
  );
}
