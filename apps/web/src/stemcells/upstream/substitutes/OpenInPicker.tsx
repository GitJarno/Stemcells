// Replaces `components/chat/OpenInPicker.tsx` (`plugin.ts`): the open-in
// shortcut acts only in the chat that owns the window's input, so with
// several chats on screen it opens one editor (`stemcells/seams.md`,
// "ChatView safe to render twice"). Outside a pane every chat owns it.
import type { ComponentProps } from "react";

import { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
import { OpenInPicker as UpstreamOpenInPicker } from "../../../components/chat/OpenInPicker";

export * from "../../../components/chat/OpenInPicker";

export function OpenInPicker(props: ComponentProps<typeof UpstreamOpenInPicker>) {
  const ownsWindowInput = useOwnsChatWindowInput();
  return (
    <UpstreamOpenInPicker
      {...props}
      enableShortcut={(props.enableShortcut ?? true) && ownsWindowInput}
    />
  );
}
