// Replaces `features/usage/usageProviders.ts` (`substitutes.cjs`): a provider whose Cells wear a
// body of their own is drawn in its colour on the usage screen (`usage/colours.ts`), as on the
// Mac, and every mark reading it here follows the chart: the legend, the provider and model rows,
// and the limit bars, here and over the composer.
import type * as Upstream from "../../../features/usage/usageProviders";
import { useCellProviderColours } from "../../usage/colours";

export * from "../../../features/usage/usageProviders";

export function useProviderColors(): ReturnType<typeof Upstream.useProviderColors> {
  return useCellProviderColours();
}
