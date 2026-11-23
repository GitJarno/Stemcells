// Replaces `hooks/useSideThreadTrigger.ts` (`plugin.ts`): a bare chat (Aski's, or a Cell peeked
// over it) draws no panel, so its menus don't offer to open a thread in one.
import { use } from "react";

import { useSideThreadTrigger as useUpstreamSideThreadTrigger } from "../../../hooks/useSideThreadTrigger";
import { ChatPanelHostContext } from "../chatPanelHost";

export { SideThreadsOpenContext } from "../../../hooks/useSideThreadTrigger";

export function useSideThreadTrigger(): ReturnType<typeof useUpstreamSideThreadTrigger> {
  const trigger = useUpstreamSideThreadTrigger();
  const bare = use(ChatPanelHostContext)?.bare === true;
  return (open, options) => trigger(open, bare ? { panel: false } : options);
}
