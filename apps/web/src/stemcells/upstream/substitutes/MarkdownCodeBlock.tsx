/**
 * Replaces `components/chat/MarkdownCodeBlock.tsx` (`plugin.ts`): in a reply, a closed `chart`
 * fence that reads draws as a chart, and a `setting` fence as its card (`fences/closedFences.ts`).
 * Every other block, and a fence still streaming, is upstream's.
 */
import { type ComponentProps, use } from "react";

import { parseChart } from "../../../../../../stemcells/chart/parse.ts";
import { readSettingFence } from "../../../../../../stemcells/settings/fence.ts";
import { MarkdownCodeBlock as UpstreamMarkdownCodeBlock } from "../../../components/chat/MarkdownCodeBlock";
import { ChartFence } from "../../chart/ChartFence";
import { fenceKey, FencesInView } from "../../fences/closedFences";
import { SettingCard } from "../../settings/SettingCard";

export * from "../../../components/chat/MarkdownCodeBlock";

export function MarkdownCodeBlock(props: ComponentProps<typeof UpstreamMarkdownCodeBlock>) {
  const fences = use(FencesInView);
  if (fences !== null && fences.closed.has(fenceKey(props.language, props.code))) {
    if (props.language === "chart" && parseChart(props.code) !== null)
      return <ChartFence source={props.code} />;
    if (props.language === "setting" && readSettingFence(props.code) !== null)
      return <SettingCard source={props.code} environmentId={fences.environmentId} />;
  }
  return <UpstreamMarkdownCodeBlock {...props} />;
}
