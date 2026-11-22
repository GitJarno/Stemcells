// A closed `chart` fence that reads as a chart draws as `ChartFence.tsx` (`fences/remarkFence.ts`).
import { parseChart } from "../../../../../stemcells/chart/parse.ts";
import { type FenceKind, mayHoldFence } from "../fences/remarkFence";

/** The context link's kind for a chart: `t3-context://v1/stemcells-chart/fence`. */
export const CHART_LINK_KIND = "stemcells-chart";

export const CHART_FENCE: FenceKind = {
  lang: "chart",
  kind: CHART_LINK_KIND,
  reads: (source) => parseChart(source) !== null,
};

/** Whether `text` may hold a closed chart fence: only such a reply runs the plugin. */
export const mayHoldChart = mayHoldFence("chart");
