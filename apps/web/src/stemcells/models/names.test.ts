import { describe, expect, it } from "vite-plus/test";

import { conciseModelName, withConciseName } from "./names";

describe("conciseModelName", () => {
  // Every name in upstream's model manifest (apps/server/src/provider/model-manifest.json).
  it.each([
    ["GPT-6.1 Sol", "Sol 6.1"],
    ["GPT-6 Astra", "Astra 6"],
    ["GPT-6 Luna", "Luna 6"],
    ["GPT-6 Sol", "Sol 6"],
    ["GPT-5.6 Sol", "Sol 5.6"],
    ["GPT-5.6 Terra", "Terra 5.6"],
    ["GPT-5.6 Luna", "Luna 5.6"],
    ["GPT-5.5", "GPT 5.5"],
    ["Claude Opus 5.5", "Opus 5.5"],
    ["Claude Sonnet 5.5", "Sonnet 5.5"],
    ["Claude Fable 5.1", "Fable 5.1"],
    ["Claude Fable 5", "Fable 5"],
    ["Claude Opus 5", "Opus 5"],
    ["Claude Opus 4.8", "Opus 4.8"],
    ["Claude Opus 4.7", "Opus 4.7"],
    ["Claude Opus 4.6", "Opus 4.6"],
    ["Claude Opus 4.5", "Opus 4.5"],
    ["Claude Sonnet 5", "Sonnet 5"],
    ["Claude Sonnet 4.6", "Sonnet 4.6"],
    ["Claude Haiku 5.5", "Haiku 5.5"],
    ["Claude Haiku 4.5", "Haiku 4.5"],
    ["Gemini 3.8 Flash (High)", "Flash 3.8 High"],
    ["Gemini 3.8 Flash (Medium)", "Flash 3.8 Medium"],
    ["Gemini 3.8 Flash (Low)", "Flash 3.8 Low"],
    ["Gemini 3.7 Flash (High)", "Flash 3.7 High"],
    ["Gemini 3.7 Flash (Medium)", "Flash 3.7 Medium"],
    ["Gemini 3.7 Flash (Low)", "Flash 3.7 Low"],
    ["Gemini 3.6 Flash (High)", "Flash 3.6 High"],
    ["Gemini 3.6 Flash (Medium)", "Flash 3.6 Medium"],
    ["Gemini 3.6 Flash (Low)", "Flash 3.6 Low"],
    ["Gemini 3.1 Pro (High)", "Pro 3.1 High"],
    ["Gemini 3.1 Pro (Low)", "Pro 3.1 Low"],
  ])("writes the manifest's %s as %s", (name, concise) => {
    expect(conciseModelName(name)).toBe(concise);
  });

  it.each([
    // Names built from a slug (formatModelSlugName, formatCodexModelName).
    ["GPT-5.6-Sol", "Sol 5.6"],
    ["GPT-5", "GPT 5"],
    ["Gemini 3 Pro", "Pro 3"],
    // A provider that puts the version before the family.
    ["Claude 4.5 Opus", "Opus 4.5"],
    // A variant on a name with no family.
    ["GPT-5.5 (High)", "GPT 5.5 High"],
    // A variant without its parentheses, as a name built from a slug has it.
    ["Gemini 3.8 Flash High", "Flash 3.8 High"],
    ["Gemini 3.1 Pro High", "Pro 3.1 High"],
    ["Gemini 3.8 Flash Minimal", "Flash 3.8 Minimal"],
    ["GPT-5.5-Xhigh", "GPT 5.5 XHigh"],
    ["GPT-5.5 (XHigh)", "GPT 5.5 XHigh"],
    // A family of two words; a variant word is never part of it.
    ["GPT-5.3-Codex-Spark", "Codex Spark 5.3"],
    ["GPT-5.1-Codex-Mini", "Codex Mini 5.1"],
    ["GPT-5.1-Codex-Max", "Codex 5.1 Max"],
    ["GPT-5.1-Codex-Mini-High", "Codex Mini 5.1 High"],
    ["Claude Opus Next 6", "Opus Next 6"],
  ])("writes %s as %s", (name, concise) => {
    expect(conciseModelName(name)).toBe(concise);
  });

  it.each([
    // Slugs and ids are never names.
    "gpt-6.1-sol",
    "claude-opus-5-5",
    "gemini-3.8-flash-high",
    "anthropic/Claude Opus 5.5",
    // Not model names, or not a shape the rule knows.
    "Claude Code",
    "Claude Max",
    "Gemini API key",
    "GPT Test",
    "Claude Haiku 4.5 20251001",
    "Claude Opus 5.5 (1M context)",
    "Claude Fable 5.1 Thinking High",
    "Gemini 3.8 Flash (Preview)",
    "GPT-5.1-Codex-Mini-Fast-High",
    "Grok 4.2",
    "Composer 2",
    "Not reported",
    // Already concise.
    "Sol 6.1",
    "Opus 5.5",
    "GPT 5.5",
    "Flash 3.8 High",
    "Codex Spark 5.3",
  ])("leaves %s as it is", (name) => {
    expect(conciseModelName(name)).toBe(name);
  });
});

describe("withConciseName", () => {
  it("writes the name and the short name", () => {
    expect(
      withConciseName({ slug: "s", name: "Claude Opus 5.5", shortName: "Claude Opus" }),
    ).toEqual({ slug: "s", name: "Opus 5.5", shortName: "Claude Opus" });
    expect(withConciseName({ slug: "s", name: "x", shortName: "GPT-6.1 Sol" })).toEqual({
      slug: "s",
      name: "x",
      shortName: "Sol 6.1",
    });
  });

  it("hands back the same model when nothing changes, so memoised rows stay put", () => {
    const model = { slug: "custom-model", name: "custom-model" };
    expect(withConciseName(model)).toBe(model);
  });
});
