// Replaces the `react-native-enriched-markdown` package for upstream's importers
// (`substitutes.cjs`): a closed `chart` fence that reads as a chart draws as one, in the reply's
// own type (`chart/ChartBlock.tsx`). Any other block, and a fence that doesn't read, is asked
// of upstream's own renderer, so it draws as before.
import { useMemo } from "react";
import {
  EnrichedMarkdownText as PackageMarkdownText,
  type MarkdownCodeBlock,
} from "react-native-enriched-markdown";

import { parseChart } from "../../../../../../stemcells/chart/parse.ts";
import { ChartBlock, type ChartInk } from "../../chart/ChartBlock";

export * from "react-native-enriched-markdown";

const colour = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

export const EnrichedMarkdownText: typeof PackageMarkdownText = (props) => {
  const { paragraph, strong, blockquote, thematicBreak } = props.markdownStyle ?? {};
  const color = colour(paragraph?.color, "#888888");
  const strongColor = colour(strong?.color, color);
  const muted = colour(blockquote?.color, color);
  const rule = colour(thematicBreak?.color, muted);
  const fontFamily = paragraph?.fontFamily;
  const strongFamily = strong?.fontFamily ?? fontFamily;
  const fontSize = paragraph?.fontSize ?? 16;
  const given = props.renderers;
  const upstreamCode = given?.code;
  // The package keeps a block's element while its renderer is the same function.
  const code = useMemo(() => {
    const ink: ChartInk = {
      color,
      strong: strongColor,
      muted,
      rule,
      fontFamily,
      strongFamily,
      fontSize,
    };
    return (block: MarkdownCodeBlock) => {
      const chart = block.isComplete && block.language === "chart" ? parseChart(block.code) : null;
      return chart === null ? upstreamCode?.(block) : <ChartBlock chart={chart} ink={ink} />;
    };
  }, [upstreamCode, color, strongColor, muted, rule, fontFamily, strongFamily, fontSize]);
  const renderers = useMemo(() => ({ ...given, code }), [given, code]);
  // A view with no renderers (upstream's own math block) stays as the package draws it.
  return given === undefined ? (
    <PackageMarkdownText {...props} />
  ) : (
    <PackageMarkdownText {...props} renderers={renderers} />
  );
};
