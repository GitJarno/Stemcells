/**
 * What a Cell's colours rely on in upstream: which provider a chat runs on
 * (`useCellDriver`) and the drivers' names. A failure here after a sync
 * names the contract that moved; the fix goes in `providers.tsx`,
 * `tokens/providers.ts` or `cell/cast.ts`, not in the views.
 */
// @effect-diagnostics nodeBuiltinImport:off - the test reads the token sheet.
import * as NodeFS from "node:fs";

import { providerClients } from "@t3tools/client-runtime/provider-clients";
import { resolveThreadProviderStack } from "@t3tools/client-runtime/state/models";
import { DEFAULT_MODEL_BY_PROVIDER, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { bodyOf } from "../cell/cast";
import { BODIES } from "../cell/kit";
import { brandTokenOf } from "../tokens/providers";
import { hasProviderLogo } from "./providers";

const tokens = NodeFS.readFileSync(new URL("../tokens/stemcells.css", import.meta.url), "utf8");

/** A token's colour as the sheet declares it, as `#RRGGBB`. */
function hexOf(token: string): string | null {
  const rgb = new RegExp(`${token}:\\s*rgba\\((\\d+), (\\d+), (\\d+), 1\\);`).exec(tokens);
  if (rgb === null) return null;
  return `#${rgb
    .slice(1)
    .map((c) => Number(c).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

describe("the provider a Cell wears the colours of", () => {
  const model = { instanceId: ProviderInstanceId.make("codex_work"), model: "gpt-5.5" };
  const history = [ProviderInstanceId.make("claudeAgent")];

  it("is the last of the chat's provider stack: the one it last chose, while it isn't running", () => {
    expect(
      resolveThreadProviderStack({
        providerInstanceHistory: history,
        modelSelection: model,
        runtime: null,
      }).at(-1),
    ).toBe("codex_work");
  });

  it("is the one its run is on, while it runs", () => {
    expect(
      resolveThreadProviderStack({
        providerInstanceHistory: history,
        modelSelection: model,
        runtime: {
          status: "running",
          activeRunId: null,
          providerInstanceId: ProviderInstanceId.make("claudeAgent"),
          providerName: null,
          lastError: null,
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
      }).at(-1),
    ).toBe("claudeAgent");
  });

  it("Claude's and Codex's drivers are the names the Cell's bodies know", () => {
    expect(Object.keys(DEFAULT_MODEL_BY_PROVIDER)).toEqual(
      expect.arrayContaining(["claudeAgent", "codex"]),
    );
    expect(bodyOf("codex")).toBe("codex");
    expect(bodyOf("claudeAgent")).toBe("claude");
  });

  // A registry agent brings its own icon, by agent rather than by driver.
  const drivers = providerClients.definitions
    .map((definition) => definition.driverKind)
    .filter((driver) => driver !== "acpRegistry");

  it("every provider upstream ships wears a colour, a mark and a body of its own", () => {
    expect(drivers).toEqual(expect.arrayContaining(["claudeAgent", "codex", "antigravity"]));
    for (const driver of drivers) {
      const token = brandTokenOf(driver);
      expect(token, driver).not.toBeNull();
      expect(hexOf(token!), driver).not.toBeNull();
      expect(hasProviderLogo(driver), driver).toBe(true);
      // The kit's coral is the original app's, brighter than Claude's brand.
      if (driver === "claudeAgent") continue;
      expect(BODIES[bodyOf(driver)]?.B, driver).toBe(hexOf(token!));
    }
  });
});
