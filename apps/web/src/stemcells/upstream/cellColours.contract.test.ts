/**
 * What a Cell's colours rely on in upstream: which provider a chat runs on
 * (`useCellDriver`) and the drivers' names. A failure here after a sync
 * names the contract that moved; the fix goes in `providers.tsx` or
 * `cell/cast.ts`, not in the views.
 */
import { resolveThreadProviderStack } from "@t3tools/client-runtime/state/models";
import { DEFAULT_MODEL_BY_PROVIDER, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { bodyOf } from "../cell/cast";

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
});
