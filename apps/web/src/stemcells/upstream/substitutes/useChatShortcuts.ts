// Replaces `components/chat/useChatShortcuts.ts` (`plugin.ts`): a chat's
// window shortcuts and type-to-focus act only in the chat that owns the
// window's input, so with several chats on screen a key acts once
// (`stemcells/seams.md`, "ChatView safe to render twice"). Outside a pane
// every chat owns it, as upstream's does.
import { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
import {
  useChatShortcuts as useUpstreamChatShortcuts,
  type ChatShortcutsInput,
} from "../../../components/chat/useChatShortcuts";

export * from "../../../components/chat/useChatShortcuts";

export function useChatShortcuts(input: ChatShortcutsInput) {
  const ownsWindowInput = useOwnsChatWindowInput();
  return useUpstreamChatShortcuts({ ...input, enabled: input.enabled && ownsWindowInput });
}
