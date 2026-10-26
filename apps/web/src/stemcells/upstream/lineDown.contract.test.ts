/**
 * A Cell peers exactly while upstream's banners say its line is down: the
 * composer's "is reconnecting / offline" banner and the provider's status
 * banner. A failure here after a sync names the rule that moved; the Cell
 * would peer with no banner saying why, or miss one.
 */
import { describe, expect, it } from "vite-plus/test";

import chatView from "../../components/ChatView.tsx?raw";
import systemBanners from "../../components/chat/useSystemComposerBanners.tsx?raw";
import { lineDownOf } from "./lineDown";

describe("a Cell's line is down while upstream's banners say so", () => {
  it("while its machine isn't connected, a reconnect only once the banner's grace has passed", () => {
    expect(lineDownOf("connected", false, null)).toBe(false);
    expect(lineDownOf(null, false, null)).toBe(false);
    for (const phase of ["offline", "error", "available", "unsupported"] as const) {
      expect(lineDownOf(phase, false, null)).toBe(true);
    }
    for (const phase of ["connecting", "reconnecting"] as const) {
      expect(lineDownOf(phase, false, null)).toBe(false);
      expect(lineDownOf(phase, true, null)).toBe(true);
    }
  });

  it("while its provider has a status banner", () => {
    expect(lineDownOf("connected", false, "codex|error|unknown|")).toBe(true);
  });

  it("matches the composer banner's own rule", () => {
    // Unavailable whenever the phase isn't "connected"; the banner holds back
    // for connecting and reconnecting until the grace has passed.
    expect(chatView).toContain(
      'activeEnvironment !== null && activeEnvironment.connection.phase !== "connected";',
    );
    expect(systemBanners).toMatch(
      /const environmentReconnecting =\s*unavailableConnection !== null &&\s*\(unavailableConnection\.phase === "connecting" \|\|\s*unavailableConnection\.phase === "reconnecting"\);/,
    );
    expect(systemBanners).toMatch(
      /useEnvironmentStateHeldFor\(\s*activeReconnectingEnvironmentId,\s*ENVIRONMENT_RECONNECT_WARNING_GRACE_MS,/,
    );
    expect(systemBanners).toContain("id: `environment-unavailable:");
    // The provider's banner shows from the key `lineDownOf` reads.
    expect(chatView).toContain(
      "const providerStatusBannerKey = getProviderStatusBannerKey(activeProviderStatus);",
    );
  });
});
