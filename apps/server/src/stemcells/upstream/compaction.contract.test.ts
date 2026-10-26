// @effect-diagnostics nodeBuiltinImport:off - reads the seam's source and the web's default.
/**
 * Upstream behaviour the auto-compact window relies on: how a Claude instance's
 * `autoCompactWindow` reaches the CLI at launch, and where the adapter says a chat compacts.
 * A failure after a sync names the contract that moved; the fix goes in
 * `stemcells/compaction/claudeWindow.ts` or the seams, not in the views.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { ClaudeSettings, ProviderInstanceId, type ModelSelection } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import * as ClaudeAdapterV2 from "../../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { DEFAULT_COMPACT_WINDOW, withCompactWindow } from "../compaction/claudeWindow.ts";

const here = NodePath.dirname(NodeURL.fileURLToPath(import.meta.url));
const read = (relative: string) => NodeFS.readFileSync(NodePath.resolve(here, relative), "utf8");

const decodeClaudeSettings = Schema.decodeSync(ClaudeSettings);

const selection = (model: string): ModelSelection => ({
  instanceId: ProviderInstanceId.make(ClaudeAdapterV2.CLAUDE_PROVIDER),
  model,
});

function launchWindow(settings: ClaudeSettings): number | undefined {
  const options = ClaudeAdapterV2.makeClaudeQueryOptions({
    modelSelection: selection("claude-opus-5-5"),
    nativeThreadId: "compaction-contract",
    resume: false,
    cwd: "/workspace",
    settings,
  });
  return (options.settings as { readonly autoCompactWindow?: number } | undefined)
    ?.autoCompactWindow;
}

describe("the auto-compact window's contracts with upstream", () => {
  it("an instance that names no window decodes to empty, which Stemcells reads as 500k", () => {
    expect(decodeClaudeSettings({}).autoCompactWindow).toBe("");
    expect(withCompactWindow(decodeClaudeSettings({})).autoCompactWindow).toBe("500000");
  });

  it("upstream's schema takes every window the settings row writes", () => {
    for (const window of ["300000", "500000", "750000", "1000000"]) {
      expect(decodeClaudeSettings({ autoCompactWindow: window }).autoCompactWindow).toBe(window);
    }
  });

  it("hands a new Claude Cell 500k at launch through the SDK's settings", () => {
    expect(launchWindow(withCompactWindow(decodeClaudeSettings({})))).toBe(500_000);
  });

  it("hands the window the person picked, and the CLI's largest for the model's own", () => {
    const pick = (autoCompactWindow: string) =>
      launchWindow(withCompactWindow(decodeClaudeSettings({ autoCompactWindow })));
    expect(pick("300000")).toBe(300_000);
    expect(pick("750000")).toBe(750_000);
    expect(pick("1000000")).toBe(1_000_000);
  });

  it("the Claude driver gives its adapter the window Cells launch with", () => {
    // The driver needs a provider host to build; its seam is one argument.
    expect(read("../../provider/Drivers/ClaudeDriver.ts")).toContain(
      "config: withCompactWindow(config),",
    );
  });

  it("the adapter reports where Claude compacts, capped by a smaller model", () => {
    const usage = { input_tokens: 1_000, output_tokens: 10 };
    const threshold = (model: string, window: string) =>
      ClaudeAdapterV2.claudeProviderTurnTokenUsage(
        usage,
        selection(model),
        "2026-10-21T00:00:00.000Z",
        window,
      ).autoCompactThreshold;
    expect(threshold("claude-opus-5-5", "500000")).toBe(467_000);
    expect(threshold("claude-haiku-4-5", "500000")).toBe(167_000);
    expect(threshold("claude-opus-5-5", "1000000")).toBe(967_000);
  });

  it("the settings row in the web starts from the same default", () => {
    const web = read("../../../../web/src/stemcells/compaction/windows.ts");
    expect(web).toContain(`DEFAULT_COMPACT_WINDOW = "${DEFAULT_COMPACT_WINDOW}"`);
  });
});
