// Replaces `features/threads/ThreadHeader.tsx` (`substitutes.cjs`): a Cell's chat is headed by the
// Cell's name, Aski's by Aski's, as the original app heads its chats by codename. A draft is a New
// Cell, as on the Mac. On iOS the bar draws the Cell beside its name (`AppBar.tsx`).
import * as Upstream from "../../../features/threads/ThreadHeader";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { cellNameOf } from "../../cell/kit";
import { ChatHeaderContext } from "../../chat/header";
import { useThreadShellsSelected } from "../cells";

export * from "../../../features/threads/ThreadHeader";

export function ThreadHeader(props: Parameters<typeof Upstream.ThreadHeader>[0]) {
  const threadId = String(props.gitControls.threadId);
  const known = useThreadShellsSelected((threads) =>
    threads.some((thread) => thread.id === threadId),
  );
  const aski = useIsAskiChat(threadId);
  const draft = props.draft === true;
  const title = draft ? "New Cell" : !known ? props.title : aski ? "Aski" : cellNameOf(threadId);
  return (
    <ChatHeaderContext value={{ threadId, titled: known && !draft }}>
      <Upstream.ThreadHeader {...props} title={title} />
    </ChatHeaderContext>
  );
}
