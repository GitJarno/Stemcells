// Replaces `features/threads/ThreadDetailScreen.tsx` (`substitutes.cjs`): the chat on screen is
// told to the words in it (`chat/inView.ts`), which name the Cells beside it as tokens, and it
// gives way to the home when the app comes back to a Cell settled meanwhile on another device
// (`chat/useClosesOnReturn.ts`).
import {
  ThreadDetailScreen as UpstreamThreadDetailScreen,
  type ThreadDetailScreenProps,
} from "../../../features/threads/ThreadDetailScreen";
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
      <UpstreamThreadDetailScreen {...props} />
    </ChatInView>
  );
}
