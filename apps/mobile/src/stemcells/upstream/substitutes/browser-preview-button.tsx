// Replaces `features/browser/browser-preview-button.tsx` (`substitutes.cjs`): the chat's browser
// pill opens its tabs in the column beside the chat where there is one (`upstream/browserColumn.ts`).
import * as Upstream from "../../../features/browser/browser-preview-button";
import { useChatInView } from "../../chat/inView";
import { useOpenBrowserColumn } from "../browserColumn";

export * from "../../../features/browser/browser-preview-button";

export function BrowserPreviewButton(
  props: Parameters<typeof Upstream.BrowserPreviewButton>[0],
): ReturnType<typeof Upstream.BrowserPreviewButton> {
  const chat = useChatInView();
  const openColumn = useOpenBrowserColumn();
  return (
    <Upstream.BrowserPreviewButton
      {...props}
      onPress={() => {
        if (chat === null || !openColumn(chat)) props.onPress();
      }}
    />
  );
}
