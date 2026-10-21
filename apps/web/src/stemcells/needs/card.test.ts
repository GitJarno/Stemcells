import { describe, expect, it } from "vite-plus/test";

import { cardOf, whenOf } from "./card";
import type { Need } from "./wire";
import { NOW, needFixture, requestFixture } from "./fixtures";

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
    expect(card.headline).toBe("Wants to run a command");
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
    expect(card.headline).toBe("Database");
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
    expect(card.headline).toBe("Has a question");
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
    expect(titles(limit("2026-10-21T11:00:00.000Z"))).toEqual(["Continue now"]);
    expect(titles(limit(null))).toEqual([]);
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
    expect(plan("plan-1").headline).toBe("Plan ready: Move the header to tokens");
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
  const prose = (cue: "question" | "offer" | "stopped", text = "Want me to push it?") =>
    cardOf(
      needFixture({
        kind: "prose",
        request: null,
        blocks: false,
        prose: { runId: "run-1", cue, text },
      }),
      NOW,
    );

  it("quotes the Cell's last paragraph word for word", () => {
    expect(prose("offer").quote).toBe("Want me to push it?");
    expect(prose("offer")).toMatchObject({ tag: "Question", headline: "Offers to go on" });
  });

  it("offers Go ahead to an offer and a stop, recommending it only for the stop", () => {
    const titles = (card: ReturnType<typeof prose>) => card.options.map((each) => each.title);
    expect(titles(prose("offer"))).toEqual(["Go ahead", "Reply…", "Nothing to do"]);
    expect(prose("offer").options[0]?.recommended).toBe(false);
    expect(prose("stopped").options[0]).toMatchObject({ title: "Go ahead", recommended: true });
    expect(prose("stopped").tag).toBe("Stopped");
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
