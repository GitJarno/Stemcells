import { describe, expect, it } from "vite-plus/test";

import manifest from "../../../../server/src/provider/model-manifest.json";
import { everyVersion, lineup, pickName, selectedIn } from "../models/lineup";

// The pick's rule (`stemcells/models/lineup.ts`) over upstream's own model manifest.

type Provider = keyof typeof manifest.providers;

/** A provider's manifest models as the server lists them: legacy ones flagged. */
function modelsOf(provider: Provider) {
  return manifest.providers[provider].models.map((model) => ({
    slug: model.slug,
    name: model.name,
    isLegacy: model.status === "legacy",
  }));
}

const labels = (entries: ReadonlyArray<{ label: string }>) => entries.map((entry) => entry.label);

describe("lineup", () => {
  it.each([
    ["claudeAgent", ["Opus", "Sonnet", "Fable", "Haiku"]],
    ["codex", ["Sol", "Astra", "Luna"]],
    ["antigravity", ["Carbon", "Argon", "Flash"]],
  ] as const)("lines %s up as its current families, by name alone", (provider, expected) => {
    expect(labels(lineup(modelsOf(provider)))).toEqual(expected);
  });

  it("folds effort baked into names into one entry's levels, least first", () => {
    const flash = lineup(modelsOf("antigravity")).find((entry) => entry.label === "Flash")!;
    expect(flash.levels.map((level) => [level.label, level.model.slug])).toEqual([
      ["Default", "gemini-3.8-flash"],
      ["Low", "gemini-3.8-flash-low"],
      ["Medium", "gemini-3.8-flash-medium"],
      ["High", "gemini-3.8-flash-high"],
    ]);
  });

  it("taps to the provider's default within a family", () => {
    const models = modelsOf("antigravity").map((model) =>
      model.slug === "gemini-3.8-flash-high" ? { ...model, isDefault: true } : model,
    );
    const flash = lineup(models).find((entry) => entry.label === "Flash")!;
    expect(flash.model.slug).toBe("gemini-3.8-flash-high");
  });

  it("keeps an older model a Cell runs, with its version, beside its family", () => {
    const entries = lineup(modelsOf("claudeAgent"), "claude-opus-4-8");
    expect(labels(entries)).toEqual(["Opus", "Opus 4.8", "Sonnet", "Fable", "Haiku"]);
    expect(selectedIn(entries, "claude-opus-4-8")?.entry.label).toBe("Opus 4.8");
  });

  it("keeps a legacy-only family a Cell runs, and its baked levels", () => {
    const entries = lineup(modelsOf("antigravity"), "gemini-3.6-flash-medium");
    const older = selectedIn(entries, "gemini-3.6-flash-medium")!;
    expect(older.entry.label).toBe("Flash 3.6");
    expect(older.level).toBe("medium");
    expect(older.entry.levels.map((level) => level.id)).toEqual(["low", "medium", "high"]);
  });

  it("lights the entry and level of a selected variant of the newest version", () => {
    const entries = lineup(modelsOf("antigravity"), "gemini-3.8-flash-low");
    const flash = selectedIn(entries, "gemini-3.8-flash-low")!;
    expect([flash.entry.label, flash.level, flash.entry.model.slug]).toEqual([
      "Flash",
      "low",
      "gemini-3.8-flash-low",
    ]);
  });

  it("keeps a name the rule can't read as it is, and a vendor-only family's version", () => {
    const entries = lineup([
      { slug: "gpt-5.5", name: "GPT-5.5" },
      { slug: "x", name: "Daybreak Blue" },
    ]);
    expect(labels(entries)).toEqual(["GPT 5.5", "Daybreak Blue"]);
  });

  it("lists every version for search", () => {
    expect(labels(everyVersion(modelsOf("claudeAgent")))).toEqual([
      "Opus 5.5",
      "Sonnet 5.5",
      "Fable 5.2",
      "Fable 5.1",
      "Fable 5",
      "Opus 5",
      "Opus 4.8",
      "Opus 4.7",
      "Opus 4.6",
      "Opus 4.5",
      "Sonnet 5",
      "Sonnet 4.6",
      "Haiku 5.5",
      "Haiku 4.5",
    ]);
  });
});

describe("pickName", () => {
  it.each([
    [{ name: "Claude Haiku 5.5" }, "Haiku"],
    [{ name: "Claude Opus 4.8", isLegacy: true }, "Opus 4.8"],
    [{ name: "GPT-6.1 Sol" }, "Sol"],
    [{ name: "GPT-5.5", isLegacy: true }, "GPT 5.5"],
    [{ name: "Gemini 3.8 Flash (High)" }, "Flash High"],
    [{ name: "Daybreak Blue" }, "Daybreak Blue"],
  ])("names %o %s", (model, name) => {
    expect(pickName(model)).toBe(name);
  });
});
