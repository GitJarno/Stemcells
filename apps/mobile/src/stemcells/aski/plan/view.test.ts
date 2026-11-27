import { describe, expect, it } from "vite-plus/test";

import { DICTATED_NOTE, type StartAct } from "../../../../../../stemcells/orchestrator/plan.ts";
import { confirm, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
import { proposed } from "./proposed.fixture";
import { headOf, messageSpans, modelLine } from "./view";

describe("what a plan's rows say", () => {
  it("shows every word of a Cell's message, the risky phrase apart and the note plain", () => {
    const words = "Tidy the branches, then force push to main.";
    const plan = proposed("plan-12345678", [
      {
        projectId: "p-harbor",
        projectName: "Harbor",
        title: "Clean up",
        words,
        risks: [{ start: 24, end: 34, kind: "history" }],
      },
    ]);
    const act = { ...(plan.acts[0] as StartAct), note: DICTATED_NOTE };
    const spans = messageSpans(act);
    expect(spans.map((span) => span.text).join("")).toBe(
      `Tidy the branches, then force push to main.\n\n${DICTATED_NOTE}`,
    );
    expect(spans.filter((span) => span.risky).map((span) => span.text)).toEqual(["force push"]);
    expect(spans.at(-1)).toMatchObject({ risky: false });
  });

  it("says the model a Cell starts on, or the default, dim", () => {
    const base = { model: null, effort: null };
    expect(modelLine(base, [])).toEqual({ text: "Default model", dim: true });
    expect(modelLine({ ...base, effort: "high" }, [])).toEqual({
      text: "Default model · high",
      dim: true,
    });
    expect(
      modelLine(
        {
          ...base,
          selection: {
            instanceId: "claudeAgent",
            model: "claude-fable-5-1",
            options: [{ id: "effort", value: "high" }],
          },
        },
        [
          {
            instanceId: "claudeAgent",
            id: "claude-fable-5-1",
            name: "Fable 5.1",
            provider: "claude",
            efforts: ["low", "high"],
            effortOption: "effort",
          },
        ],
      ),
    ).toEqual({ text: "Fable 5.1 · high", dim: false });
  });

  it("offers Start all only while several Cells wait", () => {
    const plan = proposed(
      "plan-12345678",
      ["a", "b"].map((word) => ({
        projectId: "p-harbor",
        projectName: "Harbor",
        title: word,
        words: `do ${word}`,
      })),
    );
    const tray = trayOf(plan);
    expect(headOf(tray)).toEqual({ line: "2 Cells · 2 waiting on you", startAll: true });
    expect(headOf(confirm(tray, 0))).toEqual({
      line: "2 Cells · 1 flying · 1 waiting on you",
      startAll: false,
    });
  });
});
