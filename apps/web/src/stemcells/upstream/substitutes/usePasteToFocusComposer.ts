// Replaces `components/chat/usePasteToFocusComposer.ts` (`plugin.ts`): a paste with no field
// goes only to the composer of the chat owning the window's input, so it lands once
// (`stemcells/seams.md`, "ChatView safe to render twice"); the others pass no thread, which
// upstream's hook ignores. Outside a pane every chat owns it, as upstream's does.
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
