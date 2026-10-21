// Replaces `components/usage/usageProviders.ts` (`plugin.ts`): the usage
// page draws each provider in its own colour, the one the light in its
// Cell's composer wears (`tokens/providers.ts`). Every mark that reads the
// colour here follows: the legend's dots, each line and the area under it,
// the models' bars, and the plan bars there, in the rail and over the
// composer. A provider with no colour of its own is drawn neutral.
import * as Upstream from "../../../components/usage/usageProviders";
import { brandTokenOf } from "../../tokens/providers";

export * from "../../../components/usage/usageProviders";

const NEUTRAL = "var(--sc-dim)";

export const PROVIDER_PRESENTATION = Object.fromEntries(
  Object.entries(Upstream.PROVIDER_PRESENTATION).map(([provider, presentation]) => {
    const token = brandTokenOf(presentation.driverKind);
    return [provider, { ...presentation, color: token === null ? NEUTRAL : `var(${token})` }];
  }),
) as typeof Upstream.PROVIDER_PRESENTATION;
