// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): tells the chat on
// screen to its words (`chat/inView.ts`) and its feed's end (`line/ChatAsk.tsx`), gives way to the
// home on return to a Cell settled elsewhere (`chat/useClosesOnReturn.ts`), and hands its
// pictures to the viewer (`chat/ChatGallery.tsx`).
import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
import { ChatGallery } from "../../chat/ChatGallery";
import { ChatInView } from "../../chat/inView";
import { useClosesOnReturn } from "../../chat/useClosesOnReturn";
import { AskChatContext } from "../../line/ChatAsk";

export * from "../../../features/threads/ThreadDetailScreen";

export function ThreadDetailScreen(props: ThreadDetailScreenProps) {
  const chat = {
    environmentId: props.selectedThread.environmentId,
    threadId: props.selectedThread.id,
  };
  useClosesOnReturn(chat);
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
          <UpstreamThreadDetailScreen {...props} />
        </AskChatContext>
      </ChatGallery>
    </ChatInView>
  );
}
