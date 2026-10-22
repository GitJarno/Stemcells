// Replaces `components/chat/usePasteToFocusComposer.ts` (`plugin.ts`): a
// paste with no field to land in goes to the composer of the chat that owns
// the window's input only, so with several chats on screen it lands once
// (`stemcells/seams.md`, "ChatView safe to render twice"). Upstream's hook
// takes no paste without a thread, which is how the others stand down.
// Outside a pane every chat owns it, as upstream's does.
import type { ThreadId } from "@t3tools/contracts";

import type { ComposerHandleRef } from "../../../composerHandleContext";
import { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
import { usePasteToFocusComposer as useUpstreamPasteToFocusComposer } from "../../../components/chat/usePasteToFocusComposer";

export * from "../../../components/chat/usePasteToFocusComposer";

export function usePasteToFocusComposer(
  activeThreadId: ThreadId | null,
  composerRef: ComposerHandleRef,
) {
  const ownsWindowInput = useOwnsChatWindowInput();
  return useUpstreamPasteToFocusComposer(ownsWindowInput ? activeThreadId : null, composerRef);
}
