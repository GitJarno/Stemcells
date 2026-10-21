import { describe, expect, it } from "vite-plus/test";

import { cardOf, whenOf } from "./card";
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
      title: "Try again",
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
    expect(plan("plan-1").options[0]).toMatchObject({ title: "Build it", recommended: true });
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

describe("when a reset comes, in the person's words", () => {
  const at = (iso: string) => whenOf(iso, NOW, "en-GB", "UTC");
  it("says today, tomorrow, a weekday within the week, else the date", () => {
    expect(at("2026-10-21T18:00:00.000Z")).toBe("today 18:00");
    expect(at("2026-10-22T09:00:00.000Z")).toBe("tomorrow 09:00");
    expect(at("2026-10-26T09:00:00.000Z")).toBe("Mon 09:00");
    expect(at("2026-11-02T09:00:00.000Z")).toBe("2 Nov 09:00");
  });
});
