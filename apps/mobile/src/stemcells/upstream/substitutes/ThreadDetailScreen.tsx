// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): tells the chat on
// screen to its words (`chat/inView.ts`), its feed's end (`line/ChatAsk.tsx`) and its pictures'
// viewer (`chat/ChatGallery.tsx`), closes on return to a Cell settled elsewhere, and in Aski's
// chat puts the Cells a question found under it (`recall/recall.ts`).
import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { ChatGallery } from "../../chat/ChatGallery";
import { ChatInView } from "../../chat/inView";
import { useClosesOnReturn } from "../../chat/useClosesOnReturn";
import { AskChatContext } from "../../line/ChatAsk";
import { useRecallFeed } from "../../recall/recall";

export * from "../../../features/threads/ThreadDetailScreen";

export function ThreadDetailScreen(props: ThreadDetailScreenProps) {
  const chat = {
    environmentId: props.selectedThread.environmentId,
    threadId: props.selectedThread.id,
  };
  useClosesOnReturn(chat);
  const feed = useRecallFeed(
    props.selectedThreadFeed,
    chat.environmentId,
    useIsAskiChat(chat.threadId),
  );
  return (
    <ChatInView value={chat}>
      <ChatGallery
        feed={props.selectedThreadFeed}
        place={{
          environmentId: props.environmentId,
          threadId: props.selectedThread.id,
          workspaceRoot: props.threadCwd,
        }}
      >
        <AskChatContext value={{ ...chat, canAnswer: props.canOperateThread }}>
          <UpstreamThreadDetailScreen {...props} selectedThreadFeed={feed} />
        </AskChatContext>
      </ChatGallery>
    </ChatInView>
  );
}
