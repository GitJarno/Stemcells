// A provider's own colour: its brand token in `stemcells.css`, by upstream's driver id. The one
// place a provider is given a colour: the composer's light (`glow/light.ts`) and the usage page
// (`upstream/substitutes/usageProviders.ts`) read it. A provider declared here wears its colour
// in all of them; any other wears the view's fallback.

const BRAND_BY_DRIVER: Readonly<Record<string, string>> = {
  claudeAgent: "--sc-provider-claude",
  codex: "--sc-provider-codex",
};

/** The provider's brand token, or `null` for a provider with none. */
export function brandTokenOf(driver: string | null): string | null {
  return (driver !== null && BRAND_BY_DRIVER[driver]) || null;
}
