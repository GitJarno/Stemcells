// A provider's own colour: its brand token in `stemcells.css`, by upstream's
// driver id. It is the one place a provider is given a colour, and every
// view that draws one in it reads this: the light in a Cell's composer
// (`glow/light.ts`) and the usage page's charts, legends and plan bars
// (`upstream/substitutes/usageProviders.ts`). A provider declared here wears
// its colour in all of them; any other wears the view's fallback.

const BRAND_BY_DRIVER: Readonly<Record<string, string>> = {
  claudeAgent: "--sc-provider-claude",
  codex: "--sc-provider-codex",
};

/** The provider's brand token, or `null` for a provider with none. */
export function brandTokenOf(driver: string | null): string | null {
  return (driver !== null && BRAND_BY_DRIVER[driver]) || null;
}
