import { describe, expect, it } from "vite-plus/test";

import { modelsLine, offersSignIn, providerStanding, type ProviderFacts } from "./providers.ts";

const provider = (facts: Partial<ProviderFacts> = {}): ProviderFacts => ({
  driver: "codex",
  enabled: true,
  installed: true,
  status: "ready",
  auth: { status: "authenticated" },
  models: [],
  ...facts,
});

describe("a provider in a setting card", () => {
  it("names a few models, then how many more", () => {
    const named = (...names: string[]) => provider({ models: names.map((name) => ({ name })) });
    expect(modelsLine(named())).toBeNull();
    expect(modelsLine(named("Neon", "Argon"))).toBe("Neon, Argon");
    expect(modelsLine(named("A", "B", "C", "D", "E", "F"))).toBe("A, B, C, D and 2 more");
  });

  it("says where it stands as the phone's Settings does, off and missing first", () => {
    expect(providerStanding(provider({ enabled: false, installed: false }))).toBe("Turned off");
    expect(providerStanding(provider({ installed: false }))).toBe("Not installed");
    expect(providerStanding(provider())).toBe("Signed in");
    expect(providerStanding(provider({ auth: { status: "unauthenticated" } }))).toBe(
      "Not signed in",
    );
    // Antigravity's check proves only that it's installed.
    expect(
      providerStanding(
        provider({ driver: "antigravity", status: "warning", auth: { status: "unknown" } }),
      ),
    ).toBe("Sign-in not checked");
    expect(providerStanding(provider({ status: "warning", auth: { status: "unknown" } }))).toBe(
      "Needs attention",
    );
  });

  it("offers its sign-in only when signed out and Settings would offer it", () => {
    const signedOut = { auth: { status: "unauthenticated" }, setup: { canAuthenticate: true } };
    expect(offersSignIn(provider(signedOut))).toBe(true);
    expect(offersSignIn(provider({ ...signedOut, auth: { status: "authenticated" } }))).toBe(false);
    expect(offersSignIn(provider({ ...signedOut, enabled: false }))).toBe(false);
    // A broken CLI that advertises no sign-in gets none.
    expect(offersSignIn(provider({ ...signedOut, setup: { canAuthenticate: false } }))).toBe(false);
  });
});
