// The sheet apart from the panel (`chatPanel.tsx`): a file that draws only the sheet, as
// upstream's PDF viewer test does, mustn't load upstream's whole right panel with it.
import { use, type ComponentProps } from "react";

import { RightPanelSheet } from "../../components/RightPanelSheet";
import { ChatPanelHostContext } from "./chatPanelHost";

/** Upstream's narrow-window sheet: a window overlay, so only the owning chat's opens. */
export function ChatPanelSheet(props: ComponentProps<typeof RightPanelSheet>) {
  const host = use(ChatPanelHostContext);
  if (host !== null && (!host.owns || host.bare)) return null;
  return <RightPanelSheet {...props} />;
}
