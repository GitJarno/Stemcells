import { describe, expect, it } from "vite-plus/test";

import {
  DICTATED_NOTE,
  type DestroyAct,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { confirm, done, held, trayOf } from "../../../../../../stemcells/orchestrator/tray.ts";
import { proposed } from "./proposed.fixture";
import { getsWorktree, headOf, messageSpans, modelLine, whyLines } from "./view";

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

  it("counts Cells alone beside a deletion, and nothing waits after one that is done", () => {
    const plan = proposed("plan-12345678", [
      { projectId: "p-harbor", projectName: "Harbor", title: "a", words: "do a" },
    ]);
    const cell: StartAct = {
      ...(plan.acts[0] as StartAct),
      tier: "check",
      why: ["after-hold"],
    };
    const deletion: DestroyAct = {
      kind: "destroy",
      i: 1,
      pieces: [2],
      tier: "hold",
      why: [],
      target: "project",
      place: { id: "mac:p-atlas", name: "Atlas", heard: "Atlas", how: "exact" },
      cells: [],
      words: "delete the Atlas project",
    };
    const tray = trayOf({ ...plan, acts: [cell, deletion] });
    expect(headOf(tray).line).toBe("1 Cell · 1 waiting on you");
    expect(whyLines(cell, held(tray))).toHaveLength(1);
    expect(whyLines(cell, held(done(tray, 1)))).toEqual([]);
  });

  it("counts a queued Cell in the headline, and marks a worktree of its own only where it gets one", () => {
    const plan = proposed("plan-12345678", [
      { projectId: "p-harbor", projectName: "Harbor", title: "a", words: "do a" },
      { projectId: "p-harbor", projectName: "Harbor", title: "b", words: "do b" },
      { projectId: "p-atlas", projectName: "Atlas", title: "c", words: "do c" },
    ]);
    const [first, second, third] = (plan.acts as StartAct[]).map((act): StartAct => ({
      ...act,
      tier: "start",
      why: [],
    }));
    const tray = trayOf({
      ...plan,
      acts: [first!, { ...second!, after: [0] }, { ...third!, after: [0], apart: true }],
    });
    expect(headOf(tray).line).toBe("3 Cells · 1 flying · 2 queued");
    // The project's default gives the first a worktree; the person's word can take it away.
    expect(getsWorktree(tray, first!, true)).toBe(true);
    expect(getsWorktree(tray, { ...first!, apart: false }, true)).toBe(false);
    // After a Cell of its own project it works where that one did; in another, apart.
    expect(getsWorktree(tray, tray.acts[1]!.act as StartAct, true)).toBe(false);
    expect(getsWorktree(tray, tray.acts[2]!.act as StartAct, false)).toBe(true);
    expect(modelLine(first!, [], true).text).toBe("Default model · own worktree");
  });
});
