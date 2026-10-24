import { describe, expect, it } from "vite-plus/test";

import type { Need } from "../needs/derive.ts";
import { askOf, kindOf, reversible, tookIt } from "./kinds.ts";

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

  it("leaves a card whose ask names a deploy, a merge or a deletion to the person", () => {
    for (const ask of [
      "Next, I'll deploy it to production.",
      "Then I'll merge the pull request.",
      "Next, I will push it to prod.",
      "Then I'll land it on main.",
      "Next, I'll ship it.",
      "Next I'll run git push --force.",
      "Next, I'll install the app.",
      "Next, I'll delete the old folders.",
      "Then I'll remove the old worktree and its branch.",
      "Next, git reset --hard origin/main.",
      "Next, I'll run git clean -fdx.",
      "Then rm -r the build folder.",
      "Next, I'll overwrite the user's settings.json.",
      "Also clean the throwaway isos we dont use",
      "Then I will land the PR.",
      "Next, land #293.",
      "Next, git push origin main.",
      "Then squash it into main.",
      "Next, I'll send the email.",
      "Then email the customers.",
      "Next, message the customer on Slack.",
      "Then post in #general.",
      "Next, apply the migration to the production database.",
      "Then reset the database.",
      "Next, git branch -D old-feature.",
      "Then rm the old folder.",
      "Next, cut the release.",
      "Then push the tag.",
    ]) {
      expect(reversible(ask), ask).toBe(false);
    }
    expect(kindOf(plan("# Clean up\n- Drop the users table"))).toBeNull();
  });

  it("takes a stop whose next step is ordinary work, code words and all", () => {
    for (const ask of [
      "Next, I'll add the tests.",
      "Then I'll update the docs and run the checks.",
      "Next, I'll push the branch and open the pull request.",
      "Next I'll wire Stream.merge(a, b) into the loop and run pnpm install.",
      "2 of 5 are done; next I'll do the landing page copy.",
      "Next, I'll resolve the merge conflicts in seams.md.",
      "Then I'll fix the deployment docs.",
      "Next, I'll remove the unused test files.",
      "Then I'll clean up the cache helper.",
      "Next, I'll add the subscription handler.",
      "Then I'll fix the payment form validation.",
      "Next, I'll delete the dead code path.",
      "Then I'll send the request with a retry.",
    ]) {
      expect(kindOf(stopped(ask)), ask).toBe("goAhead");
    }
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

describe("askOf", () => {
  const user = (text: string) => ({ role: "user" as const, text });
  const cell = (text: string) => ({ role: "assistant" as const, text });

  it("reads back to the person's own request, past what only carried the Cell on", () => {
    const ask = askOf([
      user("Continue where you left off."),
      cell("Working on the header…"),
      user("Fix the header so the title wraps on narrow screens."),
      user("Deploy it to production when you're done with everything else."),
    ]);
    expect(ask).toContain("Fix the header");
    expect(ask).not.toContain("Deploy");
  });

  it("a go-ahead or a yes means what the Cell offered before it", () => {
    expect(
      reversible(
        askOf([
          user("Go ahead."),
          cell("Next, I'll deploy it to production."),
          user("Fix the header so the title wraps on narrow screens."),
        ]),
      ),
    ).toBe(false);
    expect(
      reversible(
        askOf([
          user("Yes, do it."),
          cell("The checks passed. Want me to merge it?"),
          user("Fix the header so the title wraps on narrow screens."),
        ]),
      ),
    ).toBe(false);
  });
});
