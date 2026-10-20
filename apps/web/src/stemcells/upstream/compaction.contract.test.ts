/**
 * What the auto-compact window relies on in upstream's web: the Claude
 * instance setting its row writes, the card and search it lives in, and the
 * context meter it fills. If one fails after a sync, the seam moved
 * (`stemcells/seams.md`, Auto-compact window); the fix goes in
 * `compaction/` or the seam.
 */
import { ClaudeSettings, ProviderDriverKind } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import contextWindowMeterSource from "../../components/chat/ContextWindowMeter.tsx?raw";
import providerInstanceCardSource from "../../components/settings/ProviderInstanceCard.tsx?raw";
import { formatContextWindowCompactionMessage } from "../../components/chat/ContextWindowMeter.logic";
import { providerClients } from "../../components/settings/providerDriverMeta";
import { deriveProviderSettingsFields } from "../../components/settings/ProviderSettingsForm";
import { searchSettings } from "../../components/settings/settingsSearch";
import { deriveLatestContextWindowSnapshot } from "../../lib/contextWindow";
import { towardCompaction } from "../compaction/meter";
import { compactWindowIn, DEFAULT_COMPACT_WINDOW, MODEL_OWN_WINDOW } from "../compaction/windows";

const decodeClaudeSettings = Schema.decodeSync(ClaudeSettings);

describe("the auto-compact window's contracts with upstream's web", () => {
  it("upstream's settings form leaves the window to the Cells' row", () => {
    const claude = providerClients.get(ProviderDriverKind.make("claudeAgent"));
    expect(claude).toBeDefined();
    const keys = deriveProviderSettingsFields(claude!).map((field) => field.key);
    expect(keys).not.toContain("autoCompactWindow");
  });

  it("an instance that names no window decodes empty, which the row reads as the default", () => {
    expect(decodeClaudeSettings({}).autoCompactWindow).toBe("");
    expect(compactWindowIn(decodeClaudeSettings({}))).toBe(DEFAULT_COMPACT_WINDOW);
  });

  it("upstream's schema takes every window the row writes", () => {
    for (const window of ["300000", "750000", MODEL_OWN_WINDOW]) {
      expect(decodeClaudeSettings({ autoCompactWindow: window }).autoCompactWindow).toBe(window);
    }
  });

  it("a provider instance's Runtime section renders the row", () => {
    expect(providerInstanceCardSource).toContain("<CompactWindowRow");
  });

  it("settings search finds the row by the words people use", () => {
    for (const query of ["compaction", "auto compact", "autocompact", "context window"]) {
      expect(searchSettings(query).map((item) => item.id)).toContain("cell-compact-window");
    }
  });

  it("the context meter fills toward where the chat compacts", () => {
    expect(contextWindowMeterSource).toContain("towardCompaction(props.usage)");
    const snapshot = deriveLatestContextWindowSnapshot([], {
      usedTokens: 233_500,
      maxTokens: 1_000_000,
      autoCompactThreshold: 467_000,
      updatedAt: "2026-10-21T00:00:00.000Z",
    });
    expect(snapshot).not.toBeNull();
    const usage = towardCompaction(snapshot!);
    expect(usage.usedPercentage).toBe(50);
    expect(usage.maxTokens).toBe(467_000);
    expect(formatContextWindowCompactionMessage("Opus 5.5", usage.autoCompactThreshold)).toBe(
      "Compacts automatically at about 467,000 tokens.",
    );
  });
});
