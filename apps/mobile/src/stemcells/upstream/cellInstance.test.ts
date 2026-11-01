import { ProviderInstanceId, type ServerConfig } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { cellSelection } from "./cellInstance";
import {
  buildModelOptions,
  resolveDefaultableModelSelection,
  resolveSelectableModelSelection,
} from "./substitutes/modelOptions";

const claude = (instanceId: string, displayName?: string) => ({
  instanceId,
  driver: "claudeAgent",
  ...(displayName ? { displayName } : {}),
  enabled: true,
  installed: true,
  auth: { status: "authenticated" },
  models: [{ slug: "claude-opus", name: "Claude Opus", isCustom: false, capabilities: null }],
});

// The default Claude instance, and Aski's own on the same driver.
const config = {
  providers: [claude("claudeAgent"), claude("aski", "Aski")],
} as unknown as ServerConfig;
const onClaude = { instanceId: ProviderInstanceId.make("claudeAgent"), model: "claude-opus" };
const onAskis = { instanceId: ProviderInstanceId.make("aski"), model: "claude-opus" };

describe("Aski's instance on the phone", () => {
  it("a Cell is never offered it, and Claude wears no badge for it", () => {
    for (const fallback of [onClaude, null]) {
      const options = buildModelOptions(config, fallback, undefined, null);
      expect(options.map((option) => option.providerKey)).toEqual(["claudeAgent"]);
      expect(options[0]?.providerBadge?.showBadge).toBe(false);
    }
  });

  it("Aski's own chat, on its instance, keeps it", () => {
    const options = buildModelOptions(config, onAskis, undefined, null);
    expect(options.map((option) => option.providerKey)).toEqual(["claudeAgent", "aski"]);
  });

  it("a new chat never starts there", () => {
    expect(resolveSelectableModelSelection(config, onAskis, null)).toBeNull();
    expect(resolveDefaultableModelSelection(config, onAskis, null)).toBeNull();
    expect(resolveDefaultableModelSelection(config, onClaude, null)).toEqual(onClaude);
  });

  it("a Cell's selection there reads as its driver's own instance", () => {
    expect(cellSelection(config, onAskis)).toEqual(onClaude);
    expect(cellSelection(config, onClaude)).toBe(onClaude);
  });
});
