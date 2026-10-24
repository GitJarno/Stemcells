import { describe, expect, it } from "vite-plus/test";

import type { Need } from "../needs/derive.ts";
import { kindOf, tookIt } from "./kinds.ts";

const base: Need = {
  key: "thread-1:prose:run-1",
  number: 1,
  kind: "prose",
  threadId: "thread-1",
  projectId: "project-1",
  parentThreadId: null,
  title: "A Cell",
  providerInstanceId: "claudeAgent",
  since: "2026-10-24T12:00:00.000Z",
  blocks: false,
  request: null,
  plan: null,
  limit: null,
  failure: null,
  prose: null,
  stuck: null,
};

const stopped = (text: string): Need => ({
  ...base,
  prose: { runId: "run-1", cue: "stopped", text },
});
const plan = (markdown: string): Need => ({
  ...base,
  kind: "plan",
  plan: { id: "plan-1", runId: "run-1", title: null, steps: [], markdown },
});

describe("kindOf", () => {
  it("takes only a lost connection or a provider error, a stop short of done, and a plan", () => {
    const failed = (errorClass: NonNullable<Need["failure"]>["errorClass"]): Need => ({
      ...base,
      kind: "failed",
      failure: { runId: "run-1", errorClass, message: null },
    });
    expect(kindOf(failed("transport_error"))).toBe("retry");
    expect(kindOf(failed("provider_error"))).toBe("retry");
    expect(kindOf(failed("permission_error"))).toBeNull();
    expect(kindOf(failed("validation_error"))).toBeNull();
    expect(kindOf(stopped("Next, I'll add the tests."))).toBe("goAhead");
    expect(kindOf({ ...base, prose: { runId: "run-1", cue: "offer", text: "Want me to?" } })).toBe(
      null,
    );
    expect(kindOf(plan("# Tidy the list\n- Sort it\n- Test it"))).toBe("implement");
    expect(kindOf({ ...base, kind: "permission" })).toBeNull();
  });

  it("leaves a card that names a deploy, a merge or a deletion to the person", () => {
    expect(kindOf(stopped("Next, I'll deploy it to production."))).toBeNull();
    expect(kindOf(stopped("Then I'll merge the pull request."))).toBeNull();
    expect(kindOf(stopped("Next, I'll delete the old folders."))).toBeNull();
    expect(kindOf(plan("# Clean up\n- Drop the users table"))).toBeNull();
  });

  it("leaves a subagent's card to its parent", () => {
    expect(kindOf({ ...stopped("Next, I'll add the tests."), parentThreadId: "thread-0" })).toBe(
      null,
    );
  });
});

describe("tookIt", () => {
  it("reads the person's message as the card's recommendation, or not", () => {
    expect(tookIt("goAhead", " Go ahead. ")).toBe(true);
    expect(tookIt("goAhead", "Go ahead, but skip the docs.")).toBe(false);
    expect(tookIt("retry", "Try that again.")).toBe(true);
    expect(tookIt("implement", "PLEASE IMPLEMENT THIS PLAN:\n# Tidy")).toBe(true);
    expect(tookIt("implement", "Change step 2 first.")).toBe(false);
  });
});
