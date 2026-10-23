// Replaces `components/chat/useChatShortcuts.ts` (`plugin.ts`): a chat's
// window shortcuts and type-to-focus act only in the chat that owns the
// window's input, so with several chats on screen a key acts once
// (`stemcells/seams.md`, "ChatView safe to render twice"). Outside a pane
// every chat owns it, as upstream's does. A bare chat (Aski's) opens no
// surface and no terminal from a key.
import { use } from "react";

import { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
import {
  useChatShortcuts as useUpstreamChatShortcuts,
  type ChatShortcutCommands,
  type ChatShortcutsInput,
} from "../../../components/chat/useChatShortcuts";
import { ChatPanelHostContext } from "../chatPanel";

export * from "../../../components/chat/useChatShortcuts";

/** The commands that open, close or drive a chat's surfaces and terminal. */
const SURFACE_COMMAND = /^(terminal|rightPanel|threadPanel|diff|preview)\.|^view\.reopenClosed$/;

export function useChatShortcuts(input: ChatShortcutsInput) {
  const ownsWindowInput = useOwnsChatWindowInput();
  const bare = use(ChatPanelHostContext)?.bare === true;
  return useUpstreamChatShortcuts({
    ...input,
    enabled: input.enabled && ownsWindowInput,
    ...(bare
      ? {
          commands: Object.fromEntries(
            Object.entries(input.commands).filter(([command]) => !SURFACE_COMMAND.test(command)),
          ) as ChatShortcutCommands,
          fallback: (command) =>
            SURFACE_COMMAND.test(command) ? undefined : input.fallback(command),
        }
      : {}),
  });
}
