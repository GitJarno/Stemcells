// A provider in a reply's setting card (stemcells/tasks/settings-in-chat.md): when both the Mac and
// the phone offer its sign-in, the words both show for its models, and the phone's for where it
// stands, in its Settings' own.

export interface ProviderFacts {
  readonly driver: string;
  readonly enabled: boolean;
  readonly installed: boolean;
  readonly status: string;
  readonly auth: { readonly status: string };
  readonly setup?: { readonly canAuthenticate: boolean } | undefined;
  readonly models: ReadonlyArray<{ readonly name: string }>;
}

/** Whether a card offers its sign-in: signed out, on the terms Settings offers it on. */
export function offersSignIn(provider: ProviderFacts): boolean {
  return (
    provider.enabled &&
    provider.auth.status !== "authenticated" &&
    (provider.setup?.canAuthenticate === true ||
      (provider.driver === "acpRegistry" && provider.installed))
  );
}

/** The first few models by name, then how many more; null when it offers none. */
export function modelsLine(provider: ProviderFacts, shown = 4): string | null {
  const names = provider.models.map((model) => model.name);
  if (names.length === 0) return null;
  const more = names.length - shown;
  return more > 0 ? `${names.slice(0, shown).join(", ")} and ${more} more` : names.join(", ");
}

/** Where a provider stands, as the phone's Settings › Provider accounts says it. */
export function providerStanding(provider: ProviderFacts): string {
  if (!provider.enabled) return "Turned off";
  if (!provider.installed) return "Not installed";
  if (provider.auth.status === "authenticated") return "Signed in";
  if (provider.auth.status === "unauthenticated") return "Not signed in";
  // Antigravity's own check proves it installed, never that its Google sign-in holds.
  if (provider.driver === "antigravity" && provider.auth.status === "unknown")
    return "Sign-in not checked";
  if (provider.status === "error") return "Unavailable";
  if (provider.status === "warning") return "Needs attention";
  return "Ready";
}
