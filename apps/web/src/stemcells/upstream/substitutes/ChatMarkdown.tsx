/**
 * Replaces `components/ChatMarkdown.tsx` (`plugin.ts`): a reply draws Aski's setting links as
 * switches, places in Settings as links, other Cells as tokens, closed `chart` and `setting`
 * fences as a chart and a card, and a settled reply's close-out as a card. A view drawing its
 * own context links keeps its words.
 */
import { type ComponentProps, memo, type ReactNode, use } from "react";

import { linkPlaces } from "../../../../../../stemcells/settings/places.ts";
import UpstreamChatMarkdown from "../../../components/ChatMarkdown";
import { renderContextLink, type ContextLink } from "../../aski/settingLinks";
import { ChartFence } from "../../chart/ChartFence";
import { CHART_FENCE, CHART_LINK_KIND, mayHoldChart } from "../../chart/remarkChartFence";
import { CloseOutCard, LatestShown } from "../../closeOut/CloseOutCard";
import { cardOf, ReplyInView } from "../../closeOut/reply";
import { CellToken } from "../../peers/CellToken";
import { CELL_LINK_KIND, linkCellNames } from "../../peers/mentions";
import { remarkFences } from "../../fences/remarkFence";
import { PLACE_LINK_KIND, PlaceLink, placeHref } from "../../settings/PlaceLink";
import {
  mayHoldSetting,
  SETTING_CARD_KIND,
  SETTING_FENCE,
  SettingCard,
} from "../../settings/SettingCard";
import { useNamedCells } from "../cellNames";

export * from "../../../components/ChatMarkdown";

// One list, so every reply with a fence of ours shares upstream's renderer and its parse cache.
const FENCE_PLUGINS = [remarkFences([CHART_FENCE, SETTING_FENCE])];

const draw = (link: ContextLink, environmentId?: string): ReactNode =>
  link.kind === CHART_LINK_KIND ? (
    <ChartFence source={link.label} />
  ) : link.kind === SETTING_CARD_KIND ? (
    <SettingCard source={link.label} environmentId={environmentId} />
  ) : link.kind === PLACE_LINK_KIND ? (
    <PlaceLink placeKey={link.contextId} label={link.label} environmentId={environmentId} />
  ) : (
    renderContextLink(link)
  );

const drawAnywhere = (link: ContextLink) => draw(link);

// One renderer per server, so upstream's memoised markdown keeps it from render to render.
const renderers = new Map<string, (link: ContextLink) => ReactNode>();
function rendererIn(environmentId: string | undefined): (link: ContextLink) => ReactNode {
  if (environmentId === undefined) return drawAnywhere;
  let render = renderers.get(environmentId);
  if (render === undefined) {
    render = (link) =>
      link.kind === CELL_LINK_KIND ? (
        <CellToken environmentId={environmentId} threadId={link.contextId} label={link.label} />
      ) : (
        draw(link, environmentId)
      );
    renderers.set(environmentId, render);
  }
  return render;
}

type Props = ComponentProps<typeof UpstreamChatMarkdown>;

const Words = memo(function Words(props: Props) {
  const own = props.renderContextReference;
  const ref = own === undefined ? props.threadRef : undefined;
  const named = useNamedCells(ref);
  const withCells = linkCellNames(props.text, named.names);
  const text = own === undefined ? linkPlaces(withCells, placeHref) : withCells;
  // The plugin costs a streaming reply upstream's block-by-block parse, so only a reply that
  // may hold a closed fence of ours runs it.
  const fences =
    own === undefined &&
    props.inline !== true &&
    props.extraRemarkPlugins === undefined &&
    (mayHoldChart(text) || mayHoldSetting(text));
  return (
    <UpstreamChatMarkdown
      {...props}
      text={text}
      renderContextReference={own ?? rendererIn(ref?.environmentId)}
      {...(fences ? { extraRemarkPlugins: FENCE_PLUGINS } : null)}
    />
  );
});

/** A fact's link under a close-out, opened as any link in the reply is. */
function FactLink(props: { chat: Props["threadRef"]; text: string; href: string }) {
  return (
    <Words
      inline
      text={`[${props.text}](${props.href})`}
      cwd={undefined}
      threadRef={props.chat}
      parseRawHtml={false}
    />
  );
}

function ChatMarkdown(props: Props) {
  const reply = use(ReplyInView);
  const closeOut =
    props.inline === true || props.renderContextReference !== undefined
      ? null
      : cardOf(reply, props.text, props.isStreaming === true);
  if (reply === null || closeOut === null) return <Words {...props} />;
  const chat = props.threadRef;
  // The card's own words are no reply: they never read as a close-out again.
  return (
    <ReplyInView value={null}>
      {closeOut.before === "" ? null : <Words {...props} text={closeOut.before} />}
      <CloseOutCard
        closeOut={closeOut}
        words={closeOut.lines.map((line, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- A settled reply's lines, in order.
          <Words key={index} {...props} text={line.text} lineBreaks={false} />
        ))}
        foot={
          chat !== undefined && reply.last ? (
            <LatestShown reply={reply} chat={chat} Link={FactLink} />
          ) : null
        }
      />
      {closeOut.after === "" ? null : <Words {...props} text={closeOut.after} />}
    </ReplyInView>
  );
}

export default memo(ChatMarkdown);
