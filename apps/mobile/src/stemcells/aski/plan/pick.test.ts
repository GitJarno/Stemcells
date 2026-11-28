import { describe, expect, it, vi } from "vite-plus/test";

import type { ModelEntry } from "../../../../../../stemcells/orchestrator/plan.ts";
import { fieldOf } from "./pick";
import { beatsOf, staggerOf, tapsOf } from "./sent";

vi.mock("expo-haptics", () => ({ impactAsync: () => undefined, ImpactFeedbackStyle: {} }));

const models: ModelEntry[] = [
  {
    instanceId: "claudeAgent",
    id: "claude-fable-5-2",
    name: "Fable 5.2",
    provider: "claude",
    efforts: ["low", "high"],
    effortOption: "effort",
  },
  { instanceId: "codex", id: "sol-6-1", name: "Sol 6.1", provider: "codex", efforts: [] },
];

describe("a plan's Cell and the composer's model control", () => {
  it("keeps the model and its effort from the sheet's choice, and no other option", () => {
    expect(
      fieldOf(
        {
          instanceId: "claudeAgent",
          model: "claude-fable-5-2",
          options: [
            { id: "thinking", value: true },
            { id: "effort", value: "high" },
          ],
        },
        models,
      ),
    ).toEqual({
      instanceId: "claudeAgent",
      id: "claude-fable-5-2",
      name: "Fable 5.2",
      effort: { option: "effort", level: "high" },
    });
    // A model with no effort of its own carries none, whatever the choice held.
    expect(
      fieldOf(
        { instanceId: "codex", model: "sol-6-1", options: [{ id: "effort", value: "high" }] },
        models,
      ).effort,
    ).toBeNull();
  });

  it("forms a Send's Cells a stagger apart, shorter on a narrow screen, with three light taps at most", () => {
    const sent = [0, 2, 3, 5, 6];
    const wide = beatsOf(sent, false);
    expect([...wide.keys()]).toEqual(sent);
    expect(wide.get(2)).toBe(staggerOf(false));
    expect(staggerOf(true)).toBeLessThan(staggerOf(false));
    expect(tapsOf(wide)).toHaveLength(3);
    expect(tapsOf(beatsOf([4], true))).toHaveLength(1);
  });
});
