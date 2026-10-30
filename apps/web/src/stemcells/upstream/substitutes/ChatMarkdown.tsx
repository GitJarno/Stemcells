/**
 * Replaces `components/ChatMarkdown.tsx` (`plugin.ts`): a setting Aski links
 * in a reply draws as its live switch (`aski/settingLinks.tsx`), and another
 * Cell a chat names as its token (`peers/CellToken.tsx`). A view that draws its
 * own context links (the person's messages) keeps them and its words as written.
 */
import { type ComponentProps, memo, type ReactNode } from "react";

import UpstreamChatMarkdown from "../../../components/ChatMarkdown";
import { renderContextLink, type ContextLink } from "../../aski/settingLinks";
import { CellToken } from "../../peers/CellToken";
import { CELL_LINK_KIND, linkCellNames } from "../../peers/mentions";
import { useNamedCells } from "../cellNames";

export * from "../../../components/ChatMarkdown";

// One renderer per server, so upstream's memoised markdown keeps it from render to render.
const renderers = new Map<string, (link: ContextLink) => ReactNode>();
function rendererIn(environmentId: string | undefined): (link: ContextLink) => ReactNode {
  if (environmentId === undefined) return renderContextLink;
  let render = renderers.get(environmentId);
  if (render === undefined) {
    render = (link) =>
      link.kind === CELL_LINK_KIND ? (
        <CellToken environmentId={environmentId} threadId={link.contextId} label={link.label} />
      ) : (
        renderContextLink(link)
      );
    renderers.set(environmentId, render);
  }
  return render;
}

function ChatMarkdown(props: ComponentProps<typeof UpstreamChatMarkdown>) {
  const own = props.renderContextReference;
  const ref = own === undefined ? props.threadRef : undefined;
  const named = useNamedCells(ref);
  const text = linkCellNames(props.text, named.names);
  return (
    <UpstreamChatMarkdown
      {...props}
      text={text}
      renderContextReference={own ?? rendererIn(ref?.environmentId)}
    />
  );
}

export default memo(ChatMarkdown);
