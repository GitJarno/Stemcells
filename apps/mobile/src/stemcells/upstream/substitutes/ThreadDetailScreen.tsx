// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): the chat on screen is
// told to its words, which name the Cells beside it (`chat/inView.ts`), gives way to the home on
// return to a Cell settled meanwhile on another device (`chat/useClosesOnReturn.ts`), and hands
// its pictures to the viewer (`chat/ChatGallery.tsx`).
import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
import { ChatGallery } from "../../chat/ChatGallery";
import { ChatInView } from "../../chat/inView";
import { useClosesOnReturn } from "../../chat/useClosesOnReturn";

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
        <UpstreamThreadDetailScreen {...props} />
      </ChatGallery>
    </ChatInView>
  );
}
