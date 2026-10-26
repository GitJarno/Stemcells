// Replaces `components/usage/usageProviders.ts` (`plugin.ts`): the usage page draws each
// provider in the colour the light in its Cell's composer wears (`tokens/providers.ts`), and
// every mark reading it here follows: legend dots, lines and areas, model bars, and plan bars in
// the rail and over the composer. A provider with no colour of its own is drawn neutral.
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
