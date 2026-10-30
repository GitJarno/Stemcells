// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): the chat on screen is
// told to the words in it (`chat/inView.ts`), which name the Cells beside it as tokens.
import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
import { ChatInView } from "../../chat/inView";

export * from "../../../features/threads/ThreadDetailScreen";

export function ThreadDetailScreen(props: ThreadDetailScreenProps) {
  const chat = {
    environmentId: props.selectedThread.environmentId,
    threadId: props.selectedThread.id,
  };
  return (
    <ChatInView value={chat}>
      <UpstreamThreadDetailScreen {...props} />
    </ChatInView>
  );
}
