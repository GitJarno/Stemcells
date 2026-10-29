import { describe, expect, it } from "vite-plus/test";

import { askOf, cardOf, whenOf } from "./card";
import type { Need } from "./wire";
import { NOW, needFixture, proseFixture, requestFixture } from "./fixtures";

const titles = (card: ReturnType<typeof cardOf>) => card.options.map((option) => option.title);

describe("a card says what the Cell asked, as it asked it", () => {
  it("shows a permission's request whole, with the provider's own choices in its order", () => {
    const card = cardOf(
      needFixture({
        request: requestFixture({
          options: [
            { decision: "acceptForSession", label: "Allow for this session" },
            { decision: "accept", label: "Allow once", warning: "Rewrites the remote branch" },
            { decision: "decline", label: "Don't allow" },
          ],
        }),
      }),
      NOW,
    );
    expect(card.headline).toBe("Run this command?");
    expect(card.request).toBe("git push --force-with-lease origin header-tokens");
    expect(titles(card)).toEqual([
      "Allow for this session",
      "Allow once",
      "Don't allow",
      "Decline…",
    ]);
    expect(card.options[1]).toMatchObject({
      warn: true,
      consequence: "Rewrites the remote branch",
    });
    // The call on a permission is the person's: nothing is recommended.
    expect(card.options.some((option) => option.recommended)).toBe(false);
    expect(card.options.map((option) => option.allows)).toEqual([true, true, false, false]);
  });

  it("offers upstream's own buttons when the provider names none", () => {
    const card = cardOf(needFixture({ request: requestFixture() }), NOW);
    expect(titles(card)).toEqual(["Approve", "Always allow this session", "Decline", "Decline…"]);
  });

  // Without these, a Cell in full access that still asks reads like a bug in full access.
  it("says why a Cell with full access still asks, and the provider's own reason", () => {
    const plain = cardOf(needFixture({ request: requestFixture() }), NOW);
    expect([plain.quote, plain.why]).toEqual([null, null]);
    const ruled = cardOf(
      needFixture({
        request: requestFixture({
          reason: "Deletes a folder outside the project",
          fullAccessOverride: "ask_rule",
        }),
      }),
      NOW,
    );
    expect(ruled.quote).toBe("Deletes a folder outside the project");
    expect(ruled.why).toMatch(/ask rule/);
    const checked = cardOf(
      needFixture({ request: requestFixture({ fullAccessOverride: "provider_check" }) }),
      NOW,
    );
    expect(checked.why).toMatch(/no setting skips it/);
  });

  it("offers no answer to an ask that can't take one, and says why", () => {
    for (const capability of ["not_resumable", null] as const) {
      const card = cardOf(needFixture({ request: requestFixture({ capability }) }), NOW);
      expect(card.options).toEqual([]);
      expect(card.note).toMatch(/Its chat has it\.$/);
    }
  });

  it("keeps a question's options in the Cell's order and tags the Cell's pick", () => {
    const card = cardOf(
      needFixture({
        kind: "question",
        request: requestFixture({
          kind: "user_input",
          prompt: null,
          questions: [
            {
              id: "q1",
              header: "Database",
              question: "Which database should the tests use?",
              options: [
                { label: "Staging", description: "Shared, has real data", value: "staging" },
                { label: "A fresh local copy (Recommended)", description: "Slower", value: null },
              ],
              multiSelect: false,
              allowCustomAnswer: true,
            },
          ],
        }),
      }),
      NOW,
    );
    // The card's line is the Cell's own question, which its options answer.
    expect(card.headline).toBe("Which database should the tests use?");
    expect(card.questions[0]?.options).toEqual([
      {
        label: "Staging",
        description: "Shared, has real data",
        answer: "staging",
        recommended: false,
      },
      {
        label: "A fresh local copy",
        description: "Slower",
        answer: "A fresh local copy (Recommended)",
        recommended: true,
      },
    ]);
    expect(card.questions[0]?.other).not.toBeNull();
  });

  it("says a question's option once when the provider repeats its label as the description", () => {
    const card = cardOf(
      needFixture({
        kind: "question",
        request: requestFixture({
          kind: "user_input",
          prompt: null,
          responseMode: "message",
          capability: "message",
          questions: [
            {
              id: "0",
              header: "Question",
              question: "Which colour should the shed be?",
              options: [
                { label: "Green (Recommended)", description: "Green (Recommended)", value: null },
                { label: "Grey", description: "Grey", value: null },
              ],
              multiSelect: false,
              allowCustomAnswer: true,
            },
          ],
        }),
      }),
      NOW,
    );
    expect(card.headline).toBe("Which colour should the shed be?");
    expect(card.questions[0]?.options.map((each) => [each.label, each.description])).toEqual([
      ["Green", ""],
      ["Grey", ""],
    ]);
  });

  it("offers to carry on at a limit's reset, or to go on once it has passed, recommending neither", () => {
    const limit = (resetAt: string | null) =>
      cardOf(
        needFixture({
          kind: "limit",
          request: null,
          limit: { runId: "run-1", resetAt, autoResume: false },
        }),
        NOW,
      );
    expect(titles(limit("2026-10-21T18:00:00.000Z"))).toEqual(["Carry on at the reset"]);
    expect(limit("2026-10-21T11:00:00.000Z").headline).toMatch(/^Its usage limit reset today /);
    expect(titles(limit("2026-10-21T11:00:00.000Z"))).toEqual(["Continue now"]);
    // With no reset to wait for, trying again is the only way on.
    expect(titles(limit(null))).toEqual(["Continue now"]);
    expect(limit("2026-10-21T18:00:00.000Z").options[0]?.recommended).toBe(false);
  });

  it("recommends trying again only after a failure that a retry can mend", () => {
    const failed = (errorClass: "transport_error" | "validation_error") =>
      cardOf(
        needFixture({
          kind: "failed",
          request: null,
          failure: { runId: "run-1", errorClass, message: "socket closed" },
        }),
        NOW,
      );
    expect(failed("transport_error").options[0]).toMatchObject({
      title: "Retry",
      recommended: true,
    });
    expect(failed("validation_error").options[0]?.recommended).toBe(false);
    expect(failed("transport_error").quote).toBe("socket closed");
  });

  it("says a turn the full disk stopped was the disk's, and retries once there's room", () => {
    const failed = (disk: "full" | "freed" | null) =>
      cardOf(
        needFixture({
          kind: "failed",
          request: null,
          failure: {
            runId: "run-1",
            errorClass: "provider_error",
            message: "Provider turn failed.",
          },
        }),
        NOW,
        disk,
      );
    // The fix first while the disk is full: the cleanup Cell, as the chat's own row offers.
    expect(failed("full")).toMatchObject({ headline: "The disk is full" });
    expect(failed("full").options.map((each) => [each.title, each.recommended])).toEqual([
      ["Free space", true],
      ["Retry", false],
      ["Reply…", false],
      ["Dismiss", false],
    ]);
    expect(failed("freed")).toMatchObject({ headline: "The disk was full" });
    expect(failed("freed").options.map((each) => [each.title, each.recommended])).toEqual([
      ["Retry", true],
      ["Free space", false],
      ["Reply…", false],
      ["Dismiss", false],
    ]);
    expect(titles(failed(null))).not.toContain("Free space");
    expect(failed(null).quote).toBe("Provider turn failed.");
  });

  it("builds a plan it could read, and only opens the chat for one it couldn't", () => {
    const plan = (id: string | null) =>
      cardOf(
        needFixture({
          kind: "plan",
          request: null,
          plan: {
            id,
            runId: "run-1",
            title: "Move the header to tokens",
            steps: ["Read"],
            markdown: "# Move",
          },
        }),
        NOW,
      );
    expect(plan("plan-1").headline).toBe("Build “Move the header to tokens”?");
    expect(plan("plan-1").options[0]).toMatchObject({ title: "Implement", recommended: true });
    expect(plan(null).options).toEqual([]);
  });

  it("offers Later only where upstream can snooze: never while a request waits", () => {
    expect(cardOf(needFixture({ request: requestFixture() }), NOW).later).toBe(false);
    expect(
      cardOf(
        needFixture({
          kind: "failed",
          request: null,
          failure: { runId: "r", errorClass: null, message: null },
        }),
        NOW,
      ).later,
    ).toBe(true);
  });
});

describe("cards read from a Cell's prose, with no model", () => {
  const prose = (
    cue: "question" | "offer" | "stopped" | "left",
    text = "Want me to push it?",
    more: Partial<NonNullable<Need["prose"]>> = {},
  ) =>
    cardOf(
      needFixture({
        kind: "prose",
        request: null,
        blocks: false,
        prose: proseFixture(cue, text, more),
      }),
      NOW,
    );

  it("asks the Cell's own question, with the rest of its words as the context", () => {
    expect(prose("offer")).toMatchObject({ headline: "Want me to push it?", quote: null });
    expect(
      prose("question", "Both suites pass. Staging or a fresh local copy? I'd take local."),
    ).toMatchObject({
      headline: "Staging or a fresh local copy?",
      quote: "Both suites pass. I'd take local.",
    });
    // No sentence asks: the fixed line, and the Cell's words whole.
    expect(prose("question", "Let me know which you'd like.")).toMatchObject({
      headline: "Has a question",
      quote: "Let me know which you'd like.",
    });
  });

  it("offers Go ahead to an offer and a stop, recommending it only for the stop", () => {
    const titles = (card: ReturnType<typeof prose>) => card.options.map((each) => each.title);
    expect(titles(prose("offer"))).toEqual(["Go ahead", "Reply…", "Nothing to do"]);
    expect(prose("offer").options[0]?.recommended).toBe(false);
    expect(prose("stopped").options[0]).toMatchObject({ title: "Go ahead", recommended: true });
    expect(prose("stopped", "2 of 5 done. Next I'll migrate the rest.")).toMatchObject({
      headline: "Stopped short of done. Go on?",
      quote: "2 of 5 done. Next I'll migrate the rest.",
    });
  });

  // Flagged: nearly every ask read "Left a step to you. Done it?", the step itself grey under it.
  it("asks the step a Cell left, under what it did and over what waits on it", () => {
    const lead = "Everything is merged as 11 PRs.";
    const left = prose("left", "quit and reopen the desktop app", {
      steps: ["quit and reopen the desktop app"],
      lead,
    });
    expect(left).toMatchObject({
      headline: "Quit and reopen the desktop app",
      steps: [],
      quote: lead,
      next: null,
    });
    // Recommending nothing: "ok the rest" mustn't say the person did what only they can do.
    expect(left.options.map((each) => [each.title, each.consequence, each.recommended])).toEqual([
      ["Done it", "Settles it. Nothing is sent.", false],
      ["Reply…", null, false],
      ["Nothing to do", "Settles the Cell. Nothing is sent.", false],
    ]);

    const several = prose("left", "sign in · pick the plan", {
      steps: ["sign in", "pick the plan"],
      next: "deploy it once you have",
    });
    expect(several).toMatchObject({
      headline: "2 steps for you",
      steps: ["Sign in", "Pick the plan"],
      next: "deploy it once you have",
    });
    expect(several.options[0]).toMatchObject({
      title: "All done",
      consequence: "Sends “Done. Carry on.”",
    });
  });

  it("carries the reply's links, and its opening where the ask has no words of its own", () => {
    const links = [{ label: "domainshop.com", url: "https://domainshop.com" }];
    expect(prose("offer", "Want me to push it?", { lead: "Fixed.", links })).toMatchObject({
      quote: "Fixed.",
      links,
    });
  });

  it("answers a question only in the person's words: Go ahead can't answer one", () => {
    expect(prose("question", "Staging or local?").options.map((each) => each.title)).toEqual([
      "Reply…",
      "Nothing to do",
    ]);
    expect(prose("question").later).toBe(true);
  });
});

describe("a stuck card", () => {
  const stuck = (tool: NonNullable<Need["stuck"]>["tool"]) =>
    cardOf(
      needFixture({
        kind: "stuck",
        request: null,
        blocks: false,
        stuck: { runId: "run-2", quietSince: "2026-10-21T11:46:00.000Z", tool },
      }),
      NOW,
    );

  it("says how long it has been quiet, and shows a command it is in whole", () => {
    expect(stuck(null).headline).toBe("Quiet for 14 min");
    const card = stuck({ title: "Run tests", command: "pnpm test:migrate" });
    expect(card.headline).toBe("Quiet for 14 min in a tool call");
    expect(card.request).toBe("pnpm test:migrate");
    expect(stuck({ title: "Search the web", command: null }).quote).toBe("Search the web");
  });

  it("offers a nudge, a restart in the person's words, or a wait, and no second Later", () => {
    const card = stuck(null);
    expect(card.options.map((each) => each.title)).toEqual([
      "Nudge…",
      "Stop and reply…",
      "Wait 15 min",
    ]);
    expect(card.options.some((each) => each.recommended)).toBe(false);
    expect(card.later).toBe(false);
  });
});

describe("when a reset comes, in the person's words", () => {
  const at = (iso: string) => whenOf(iso, NOW, "en-GB", "UTC");
  it("says today, tomorrow, a weekday within the week, else the date", () => {
    expect(at("2026-10-21T18:00:00.000Z")).toBe("today 18:00");
    expect(at("2026-10-22T09:00:00.000Z")).toBe("tomorrow 09:00");
    expect(at("2026-10-26T09:00:00.000Z")).toBe("Mon 09:00");
    expect(at("2026-11-02T09:00:00.000Z")).toBe("2 Nov 09:00");
  });
});

describe("askOf", () => {
  it("takes a list's question without its number, and keeps the rest in order", () => {
    expect(
      askOf(
        "Decisions for you: 1. Approve the 6 held people. 2. Should the 5 companies be created now? I'd skip them.",
      ),
    ).toEqual({
      ask: "Should the 5 companies be created now?",
      context: "Decisions for you: 1. Approve the 6 held people. I'd skip them.",
    });
  });

  it("reads a question mark inside a quote or a path as no ask", () => {
    expect(askOf("Pushed to `feat/why?-not`. Done.")).toBeNull();
    expect(askOf("Ship it (“today?”)")).toEqual({ ask: "Ship it (“today?”)", context: null });
  });
});
