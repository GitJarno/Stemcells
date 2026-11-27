// Replaces `components/chat/MessagesTimeline.tsx` (`plugin.ts`): hands the entries it draws to
// our rows' context and the media viewer (`media/chatEntries.ts`), ends a Cell's chat on its ask
// (`needs/ChatAsk.tsx`) in upstream's footer, whose growth the list follows, and marks when it
// follows its end (`tabs/keepEnd.ts`). Both only with entries, so empty keeps upstream's state.
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { type ComponentProps, use } from "react";

import { MessagesTimeline as UpstreamMessagesTimeline } from "../../../components/chat/MessagesTimeline";
import { usePublishChatEntries } from "../../media/chatEntries";
import { ChatAsk } from "../../needs/ChatAsk";
import { PeerExchangeProvider } from "../../peers/PeerExchange";
import { PaneCellContext } from "../../tabs/paneCell";
import { TurnVerbsProvider } from "../../verbs/WorkWord";

export * from "../../../components/chat/MessagesTimeline";

export function MessagesTimeline(props: ComponentProps<typeof UpstreamMessagesTimeline>) {
  usePublishChatEntries(props.routeThreadKey, props.timelineEntries);
  const cell = use(PaneCellContext);
  const entries = props.timelineEntries.length > 0;
  // The pane's own Cell: a linked chat in its side panel is another's.
  const shown =
    entries && cell?.draftId === null ? parseScopedThreadKey(props.routeThreadKey) : null;
  const asks =
    cell !== null &&
    shown?.threadId === cell.threadId &&
    shown.environmentId === cell.environmentId;
  const follows = entries && props.liveFollowEnabled && props.anchorMessageId === null;
  return (
    <TurnVerbsProvider entries={props.timelineEntries}>
      <PeerExchangeProvider entries={props.timelineEntries}>
        <UpstreamMessagesTimeline
          {...props}
          footer={
            asks || follows ? (
              <>
                {asks ? (
                  <div className="chat-content-lane">
                    <ChatAsk cell={cell} />
                  </div>
                ) : null}
                {props.footer}
                {follows ? <i hidden data-stemcells-follows="" /> : null}
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
