// Replaces `components/chat/MessagesTimeline.tsx` (`plugin.ts`): it hands the entries it draws to
// its rows in our context (`TurnVerbsProvider`, `PeerExchangeProvider`) and to the media viewer
// (`media/chatEntries.ts`). While it follows its end, a footer mark tells the pane to hold it
// (`tabs/keepEnd.ts`); only with entries, so an empty one keeps upstream's empty state.
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
