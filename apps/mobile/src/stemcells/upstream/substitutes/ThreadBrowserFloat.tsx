// Replaces `features/browser/ThreadBrowserFloat.tsx` (`substitutes.cjs`): the floating player an
// agent's tab pops opens the tab in the column beside the chat where there is one
// (`upstream/browserColumn.ts`).
import * as Upstream from "../../../features/browser/ThreadBrowserFloat";
import { useOpenBrowserColumn } from "../browserColumn";

export * from "../../../features/browser/ThreadBrowserFloat";

export function ThreadBrowserFloat(
  props: Parameters<typeof Upstream.ThreadBrowserFloat>[0],
): ReturnType<typeof Upstream.ThreadBrowserFloat> {
  const openColumn = useOpenBrowserColumn();
  return (
    <Upstream.ThreadBrowserFloat
      {...props}
      onOpen={(tabId) => {
        if (!openColumn(props, tabId)) props.onOpen(tabId);
      }}
    />
  );
}
