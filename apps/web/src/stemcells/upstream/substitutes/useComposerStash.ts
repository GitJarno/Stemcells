// Replaces `components/chat/useComposerStash.ts` (`plugin.ts`): the stash
// shortcut acts only in the chat that owns the window's input, so with
// several chats on screen one press stashes one draft (`stemcells/seams.md`,
// "ChatView safe to render twice"). Upstream's hook reads its keys for that
// shortcut alone (`windowInputGates.test.tsx` pins it), so handed none it
// hears no shortcut and keeps the rest of the stash. Outside a pane every
// chat owns it, as upstream's does.
import { useOwnsChatWindowInput } from "../../../components/chat/chatWindowInput";
import { useComposerStash as useUpstreamComposerStash } from "../../../components/chat/useComposerStash";

export * from "../../../components/chat/useComposerStash";

type StashInput = Parameters<typeof useUpstreamComposerStash>[0];

const NO_KEYS: StashInput["keybindings"] = [];

export function useComposerStash(input: StashInput) {
  const ownsWindowInput = useOwnsChatWindowInput();
  return useUpstreamComposerStash(ownsWindowInput ? input : { ...input, keybindings: NO_KEYS });
}
