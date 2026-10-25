// Replaces `features/threads/ThreadHeader.tsx` (`substitutes.cjs`): a Cell's
// chat is headed by the Cell's name, Aski's by Aski's, as the original app heads
// its chats by codename; what the chat is about stands on the composer's
// ledge (`ledge/CellLedge.tsx`). A draft keeps upstream's title.
import * as Upstream from "../../../features/threads/ThreadHeader";
import { useIsAskiChat } from "../../aski/useAskiChat";
import { cellNameOf } from "../../cell/kit";
import { useThreadShellsSelected } from "../cells";

export * from "../../../features/threads/ThreadHeader";

export function ThreadHeader(props: Parameters<typeof Upstream.ThreadHeader>[0]) {
  const threadId = String(props.gitControls.threadId);
  const known = useThreadShellsSelected((threads) =>
    threads.some((thread) => thread.id === threadId),
  );
  const aski = useIsAskiChat(threadId);
  if (props.draft === true || !known) return <Upstream.ThreadHeader {...props} />;
  const title = aski ? "Aski" : cellNameOf(threadId);
  return <Upstream.ThreadHeader {...props} title={title} />;
}
