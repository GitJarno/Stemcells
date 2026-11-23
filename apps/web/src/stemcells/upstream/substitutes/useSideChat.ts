// Replaces `components/chat/useSideChat.ts` (`plugin.ts`): a bare chat (Aski's, or a Cell peeked
// over it) draws no panel, so it starts no side chat: `/side` would fork one nobody sees.
import { use } from "react";

import { useSideChat as useUpstreamSideChat } from "../../../components/chat/useSideChat";
import { ChatPanelHostContext } from "../chatPanelHost";

export type { SideChatMessage } from "../../../components/chat/useSideChat";

export function useSideChat(input: Parameters<typeof useUpstreamSideChat>[0]) {
  const bare = use(ChatPanelHostContext)?.bare === true;
  return useUpstreamSideChat(bare ? { ...input, threadRef: null } : input);
}
