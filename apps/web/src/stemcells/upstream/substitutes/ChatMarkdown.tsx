/**
 * Replaces `components/ChatMarkdown.tsx` (`plugin.ts`): a setting Aski links
 * in a reply draws as its live switch (`aski/settingLinks.tsx`). A view that
 * draws its own context links (the person's messages) keeps them; any other
 * context link reads as upstream's plain words.
 */
import { type ComponentProps, memo } from "react";

import UpstreamChatMarkdown from "../../../components/ChatMarkdown";
import { renderContextLink } from "../../aski/settingLinks";

export * from "../../../components/ChatMarkdown";

function ChatMarkdown(props: ComponentProps<typeof UpstreamChatMarkdown>) {
  return (
    <UpstreamChatMarkdown
      {...props}
      renderContextReference={props.renderContextReference ?? renderContextLink}
    />
  );
}

export default memo(ChatMarkdown);
