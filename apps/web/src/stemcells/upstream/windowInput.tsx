/**
 * Upstream's own gate on a chat's global shortcuts (`BackgroundThreadContext`,
 * shut under Settings or Usage), shut too in a pane that doesn't own the
 * window's input: inside its composer, the stash shortcut and the digit keys
 * that answer a question stand down.
 */
import { use, type ReactNode } from "react";

import { BackgroundThreadContext } from "../../components/chat/backgroundThread";
import { useOwnsChatWindowInput } from "../../components/chat/chatWindowInput";

export function WindowInputGate(props: { readonly children: ReactNode }) {
  const underModal = use(BackgroundThreadContext);
  const owns = useOwnsChatWindowInput();
  return (
    <BackgroundThreadContext value={underModal || !owns}>{props.children}</BackgroundThreadContext>
  );
}
