// A chat's browser tabs open in the inspector column beside it, as its Device panel does
// (`ThreadDetailScreen`'s `openDevicePreview`); where the screen has no column they open full screen.
import { Keyboard } from "react-native";

import { useOpenThreadInspector } from "../../features/threads/thread-inspector-navigation";

export interface BrowserChat {
  readonly environmentId: string;
  readonly threadId: string;
}

/** Shows `chat`'s browser in the column and says true, or says false where there is none. */
export function useOpenBrowserColumn() {
  const openInspector = useOpenThreadInspector();
  return (chat: BrowserChat, tabId?: string) => {
    const target = {
      type: "browser" as const,
      environmentId: chat.environmentId,
      threadId: chat.threadId,
      ...(tabId === undefined ? {} : { tabId }),
    };
    if (!openInspector(chat, target)) return false;
    Keyboard.dismiss();
    return true;
  };
}
