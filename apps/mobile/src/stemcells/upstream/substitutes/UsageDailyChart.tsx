// Replaces `features/usage/UsageDailyChart.tsx` and its `.ios.tsx` (`substitutes.cjs`): the
// usage screen's chart is the Mac's, a smoothed line per provider over a faint fill in its Cells'
// colour (`usage/UsageChart.tsx`), where T3's phone stacks bars.
export type { UsageDailyChartProps } from "../../../features/usage/UsageDailyChart";
export { UsageDailyChart } from "../../usage/UsageChart";
