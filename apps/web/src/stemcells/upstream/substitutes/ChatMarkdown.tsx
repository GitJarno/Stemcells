/**
 * Replaces `components/ChatMarkdown.tsx` (`plugin.ts`): in a reply, a setting Aski links draws
 * as its live switch (`aski/settingLinks.tsx`), another Cell as its token (`peers/CellToken.tsx`)
 * and a closed `chart` fence as its chart (`chart/ChartFence.tsx`). A view that draws its own
 * context links (the person's messages) keeps them and its words as written.
 */
import { type ComponentProps, memo, type ReactNode } from "react";

import UpstreamChatMarkdown from "../../../components/ChatMarkdown";
import { renderContextLink, type ContextLink } from "../../aski/settingLinks";
import { ChartFence } from "../../chart/ChartFence";
import { CHART_LINK_KIND, mayHoldChart, remarkChartFence } from "../../chart/remarkChartFence";
import { CellToken } from "../../peers/CellToken";
import { CELL_LINK_KIND, linkCellNames } from "../../peers/mentions";
import { useNamedCells } from "../cellNames";

export * from "../../../components/ChatMarkdown";

// One list, so every reply with a chart shares upstream's renderer and its parse cache.
const CHART_PLUGINS = [remarkChartFence];

const draw = (link: ContextLink): ReactNode =>
  link.kind === CHART_LINK_KIND ? <ChartFence source={link.label} /> : renderContextLink(link);

// One renderer per server, so upstream's memoised markdown keeps it from render to render.
const renderers = new Map<string, (link: ContextLink) => ReactNode>();
function rendererIn(environmentId: string | undefined): (link: ContextLink) => ReactNode {
  if (environmentId === undefined) return draw;
  let render = renderers.get(environmentId);
  if (render === undefined) {
    render = (link) =>
      link.kind === CELL_LINK_KIND ? (
        <CellToken environmentId={environmentId} threadId={link.contextId} label={link.label} />
      ) : (
        draw(link)
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
  // The plugin costs a streaming reply upstream's block-by-block parse, so only a reply that
  // may hold a closed chart runs it.
  const charts =
    own === undefined &&
    props.inline !== true &&
    props.extraRemarkPlugins === undefined &&
    mayHoldChart(text);
  return (
    <UpstreamChatMarkdown
      {...props}
      text={text}
      renderContextReference={own ?? rendererIn(ref?.environmentId)}
      {...(charts ? { extraRemarkPlugins: CHART_PLUGINS } : null)}
    />
  );
}

export default memo(ChatMarkdown);
