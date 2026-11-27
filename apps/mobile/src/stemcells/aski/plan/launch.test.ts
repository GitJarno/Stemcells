import { describe, expect, it } from "vite-plus/test";

import {
  DICTATED_NOTE,
  type ModelEntry,
  type StartAct,
} from "../../../../../../stemcells/orchestrator/plan.ts";
import { ProviderInstanceId } from "../../upstream/planLaunch";
import { launchOf, type LaunchSetup, selectionOf } from "./launch";

const act = (over: Partial<StartAct> = {}): StartAct => ({
  kind: "start",
  i: 0,
  pieces: [1],
  tier: "start",
  why: [],
  threadId: "thread-otter",
  title: "Fix the product page header",
  words: "fix the header on the product page",
  note: null,
  place: { id: "mac:p-harbor", name: "Harbor", heard: "Harbor", how: "exact" },
  model: null,
  effort: null,
  risks: [],
  ...over,
});

const models: ModelEntry[] = [
  {
    instanceId: "codex",
    id: "gpt-6.1-sol",
    name: "Sol 6.1",
    provider: "codex",
    efforts: ["low", "medium", "high", "xhigh"],
    effortOption: "reasoningEffort",
  },
];

const setup = (over: Partial<LaunchSetup> = {}): LaunchSetup => ({
  projectId: "p-harbor",
  projectName: "Harbor",
  projectCwd: "/work/harbor",
  defaultModel: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-6.1-sol" },
  runtimeMode: "approval-required",
  interactionMode: "default",
  models,
  ready: () => true,
  commandId: "command-1",
  messageId: "message-1",
  createdAt: "2026-11-27T10:00:00.000Z",
  ...over,
});

describe("a plan's Cell as the phone starts it", () => {
  it("is the plan's own thread, in its project's root, told the person's words", () => {
    const launch = launchOf(act({ note: DICTATED_NOTE }), setup());
    if (!launch.ok) throw new Error(launch.reason);
    const { input } = launch;
    expect(input.threadId).toBe("thread-otter");
    expect(input.message.text).toBe(`fix the header on the product page\n\n${DICTATED_NOTE}`);
    expect(input.message.attachments).toEqual([]);
    expect(input.titleSeed).toBe("Fix the product page header");
    expect(input.bootstrap.createThread).toMatchObject({
      projectId: "p-harbor",
      title: "Fix the product page header",
      branch: null,
      worktreePath: null,
      runtimeMode: "approval-required",
      interactionMode: "default",
    });
    // The project's root: no worktree is prepared.
    expect("prepareWorktree" in input.bootstrap).toBe(false);
    expect(input.runtimeMode).toBe("approval-required");
  });

  it("runs on the model Aski's chat named whole, as given, before any other", () => {
    const selection = {
      instanceId: "claudeAgent",
      model: "claude-fable-5-1",
      options: [{ id: "effort", value: "high" }],
    };
    const named = act({
      selection,
      model: {
        instanceId: "codex",
        id: "gpt-6.1-sol",
        name: "Sol 6.1",
        heard: "Sol",
        how: "exact",
        effort: null,
      },
    });
    expect(selectionOf(named, setup())).toEqual(selection);
  });

  it("then on the model the person said, at the effort they said", () => {
    const said = act({
      model: {
        instanceId: "claudeAgent",
        id: "claude-fable-5-1",
        name: "Fable 5.1",
        heard: "Fable",
        how: "exact",
        effort: { option: "effort", level: "high" },
      },
    });
    expect(selectionOf(said, setup())).toEqual({
      instanceId: "claudeAgent",
      model: "claude-fable-5-1",
      options: [{ id: "effort", value: "high" }],
    });
  });

  it("else on the project's default, at an effort the person said for it", () => {
    expect(selectionOf(act(), setup())).toEqual({ instanceId: "codex", model: "gpt-6.1-sol" });
    // "max" on a ladder that tops out at xhigh is xhigh.
    expect(selectionOf(act({ effort: "max" }), setup())).toEqual({
      instanceId: "codex",
      model: "gpt-6.1-sol",
      options: [{ id: "reasoningEffort", value: "xhigh" }],
    });
  });

  it("doesn't start with no model, or on a provider that can't start now", () => {
    expect(launchOf(act(), setup({ defaultModel: null }))).toEqual({
      ok: false,
      reason: "No model to start a Cell in Harbor on.",
    });
    expect(launchOf(act(), setup({ ready: () => false })).ok).toBe(false);
  });
});
