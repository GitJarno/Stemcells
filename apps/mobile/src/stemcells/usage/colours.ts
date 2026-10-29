// The colour a provider wears on the usage screen: its Cells' body where they wear one of their
// own (Claude's coral, Codex's green; `cell/kit.ts`), so the chart says who as the Cells on the
// home do, and upstream's colour for the rest, which keeps them apart from Claude's coral.
import { BODIES, bodyOf } from "../cell/kit";
import { type UsageProviderKind, useProviderColors } from "../upstream/usage";

/** The coral Cell: Claude's, and every provider's without a body of its own. */
const SHARED_BODY = bodyOf(null);

function cellColourOf(provider: UsageProviderKind): string | undefined {
  const body = bodyOf(provider);
  return body !== SHARED_BODY || provider === "claude" ? BODIES[body]?.B : undefined;
}

export function useCellProviderColours(): ReturnType<typeof useProviderColors> {
  const colours = { ...useProviderColors() };
  for (const provider of Object.keys(colours) as UsageProviderKind[]) {
    colours[provider] = cellColourOf(provider) ?? colours[provider];
  }
  return colours;
}
