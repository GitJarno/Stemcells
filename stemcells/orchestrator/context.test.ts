import { describe, expect, it } from "vite-plus/test";

import { byRecency, type CatalogProvider, gateNames, modelEntries } from "./context.ts";
import { wantsCompiler } from "./gate.ts";

const EFFORT_OPTIONS = ["reasoningEffort", "effort"];

const effort = (id: string, levels: string[]) => ({
  optionDescriptors: [
    { id: "fastMode", type: "boolean" },
    { id, type: "select", options: levels.map((level) => ({ id: level })) },
  ],
});

/** Providers as a server lists them: Aski's own instance beside the person's. */
const providers: CatalogProvider[] = [
  {
    instanceId: "aski",
    usable: true,
    word: "claude",
    models: [{ slug: "claude-fable-5-1", name: "Claude Fable 5.1", capabilities: null }],
  },
  {
    instanceId: "claudeAgent",
    usable: true,
    word: "claude",
    models: [
      {
        slug: "claude-fable-5-1",
        name: "Claude Fable 5.1",
        aliases: ["fable"],
        capabilities: effort("effort", ["low", "medium", "high", "xhigh"]),
      },
      { slug: "claude-haiku-5-5", name: "Claude Haiku 5.5", capabilities: null },
    ],
  },
  {
    instanceId: "codex",
    usable: true,
    word: "codex",
    models: [
      {
        slug: "gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        capabilities: effort("reasoningEffort", ["low", "medium", "high", "xhigh", "max"]),
      },
    ],
  },
  {
    instanceId: "cursor",
    usable: false,
    word: "cursor",
    models: [{ slug: "composer-2", name: "Composer 2", capabilities: null }],
  },
];

describe("the models a Cell can run on", () => {
  const models = modelEntries(providers, EFFORT_OPTIONS);

  it("names each as a person reads it, with its own effort ladder", () => {
    expect(models).toEqual([
      {
        instanceId: "claudeAgent",
        id: "claude-fable-5-1",
        name: "Fable 5.1",
        provider: "claude",
        efforts: ["low", "medium", "high", "xhigh"],
        effortOption: "effort",
        aliases: ["fable"],
      },
      {
        instanceId: "claudeAgent",
        id: "claude-haiku-5-5",
        name: "Haiku 5.5",
        provider: "claude",
        efforts: [],
      },
      {
        instanceId: "codex",
        id: "gpt-6.1-sol",
        name: "Sol 6.1",
        provider: "codex",
        efforts: ["low", "medium", "high", "xhigh", "max"],
        effortOption: "reasoningEffort",
      },
    ]);
  });

  it("leaves out Aski's own instance and a provider no Cell can start on", () => {
    expect(new Set(models.map((model) => model.instanceId))).toEqual(
      new Set(["claudeAgent", "codex"]),
    );
  });

  it("gives the gate each model's family and each project's name", () => {
    const names = gateNames([{ name: "Harbor Design" }, { name: "Atlas" }], models);
    expect(wantsCompiler("Sol: write the docs", names)).toBe(true);
    expect(wantsCompiler("Fable fix the header", names)).toBe(true);
    expect(wantsCompiler("harbor design tidy the tokens", names)).toBe(true);
    expect(wantsCompiler("tidy the tokens please", names)).toBe(false);
  });
});

describe("places by when they were last used", () => {
  it("puts the latest first and the never used after, in their own order", () => {
    const places = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
    const lastUsed = new Map([
      ["c", "2026-11-20T10:00:00.000Z"],
      ["a", "2026-11-27T09:00:00.000Z"],
    ]);
    expect(byRecency(places, lastUsed).map((place) => place.id)).toEqual(["a", "c", "b", "d"]);
  });
});
