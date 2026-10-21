import { describe, expect, it } from "vite-plus/test";

import { cardOf, LATER } from "../card";
import { NOW, needFixture, requestFixture } from "../fixtures";
import type { Need } from "../wire";
import { enterOf } from "./enter";
import { partLines } from "./line";
import { type Addressee, readAnswers } from "./read";

const addressee = (need: Need, who: string, gone = false): Addressee => ({
  number: need.number,
  who,
  name: need.parentThreadId === null ? who : null,
  kind: need.kind,
  cue: need.prose?.cue ?? null,
  card: cardOf(need, NOW),
  gone,
  held: false,
});

/** The doc's four cards, and one of each other kind. */
const CARDS: Addressee[] = [
  addressee(
    needFixture({
      key: "thread-floof:prose:run-1",
      number: 1,
      kind: "prose",
      threadId: "thread-floof",
      prose: { runId: "run-1", cue: "question", text: "Staging, or a fresh local copy?" },
    }),
    "Floof",
  ),
  addressee(
    needFixture({
      key: "thread-bongo:stuck:run-2",
      number: 2,
      kind: "stuck",
      threadId: "thread-bongo",
      stuck: {
        runId: "run-2",
        quietSince: "2026-10-21T11:40:00.000Z",
        tool: { title: "Run tests", command: "pnpm test:migrate" },
      },
    }),
    "Bongo",
  ),
  addressee(needFixture({ number: 3, threadId: "thread-pip", request: requestFixture() }), "Pip"),
  addressee(
    needFixture({
      key: "thread-otter:limit:run-4",
      number: 4,
      kind: "limit",
      threadId: "thread-otter",
      limit: { runId: "run-4", resetAt: "2026-10-21T15:00:00.000Z", autoResume: false },
    }),
    "Otter",
  ),
  addressee(
    needFixture({
      key: "thread-mochi:request:question-1",
      number: 5,
      kind: "question",
      threadId: "thread-mochi",
      request: requestFixture({
        id: "question-1",
        kind: "user_input",
        prompt: null,
        questions: [
          {
            id: "old-copy",
            header: "Old copy",
            question: "Remove the old copy before the commit, or after?",
            options: [
              { label: "Commit, then remove", description: "", value: null },
              { label: "Remove it first", description: "", value: null },
            ],
            multiSelect: false,
            allowCustomAnswer: true,
          },
        ],
      }),
    }),
    "Mochi",
  ),
  addressee(
    needFixture({
      key: "thread-gus:prose:run-6",
      number: 6,
      kind: "prose",
      threadId: "thread-gus",
      prose: { runId: "run-6", cue: "offer", text: "Want me to update the docs too?" },
    }),
    "Gus",
  ),
  addressee(
    needFixture({
      key: "thread-kiwi:plan:run-7",
      number: 7,
      kind: "plan",
      threadId: "thread-kiwi",
      plan: { id: "plan-7", runId: "run-7", title: "Tokens", steps: [], markdown: "# Tokens" },
    }),
    "Kiwi",
  ),
  addressee(
    needFixture({
      key: "thread-taco:failed:run-8",
      number: 8,
      kind: "failed",
      threadId: "thread-taco",
      failure: { runId: "run-8", errorClass: "transport_error", message: "socket hang up" },
    }),
    "Taco",
  ),
  addressee(
    needFixture({
      number: 9,
      kind: "sign-in",
      threadId: "thread-yeti",
      request: requestFixture({ id: "auth-9", kind: "auth_refresh", prompt: null }),
    }),
    "Yeti",
  ),
];

/** Card n's option i (from 1), as the card titles it. */
const title = (n: number, i: number) => CARDS[n - 1]!.card.options[i - 1]!.title;
const allow = (n: number) => CARDS[n - 1]!.card.options.find((o) => o.allows)!.title;
const kindOf = (n: number, kind: string) =>
  CARDS[n - 1]!.card.options.find((o) => o.choice.kind === kind)!.title;
const decline = (n: number) =>
  CARDS[n - 1]!.card.options.find(
    (o) => o.choice.kind === "decide" && o.choice.decision === "decline",
  )!.title;

/** The readout's parts, then what goes to Aski. */
function preview(text: string, cards: ReadonlyArray<Addressee> = CARDS): string {
  const { parts, rest } = readAnswers(text, cards);
  const lines = parts.flatMap((part) => partLines(part, cards));
  const left = rest.map((span) => text.slice(span.start, span.end));
  return [...lines, ...(left.length > 0 ? [`rest: ${left.join(" ")}`] : [])].join(" · ");
}

describe("readAnswers: the doc's examples", () => {
  it.each([
    [
      "for 5 go with 2, for 2 reply use staging",
      "5 Mochi: Remove it first · 2 Bongo: stop, then reply “use staging”",
    ],
    [
      "for five go with two. for two reply use staging",
      "5 Mochi: Remove it first · 2 Bongo: stop, then reply “use staging”",
    ],
    ["5: commit then remove", "5 Mochi: Commit, then remove"],
    ["Mochi, remove it first", "5 Mochi: Remove it first"],
    [
      "for decision 5, let's go with 2; for decision 2, let's do use staging",
      "5 Mochi: Remove it first · 2 Bongo: stop, then reply “let's do use staging”",
    ],
    ["3 yes", `3 Pip: ${allow(3)} — needs your click`],
    ["3 no, use a normal push", "3 Pip: Decline, with “use a normal push”"],
    ["3 no", `3 Pip: ${decline(3)}`],
    ["for 3 go with 2", `3 Pip: ${title(3, 2)} — needs your click`],
    ["for 2 go with 1", `2 Bongo: ${title(2, 1)} — say what`],
    ["for 4 wait", `4 Otter: ${kindOf(4, "carryOn")}`],
    ["1 and 2 later", `1 Floof: ${LATER.title} · 2 Bongo: ${kindOf(2, "wait")}`],
    ["for 2, go with 3", `2 Bongo: ${title(2, 3)}`],
    ["for 1 the safer one", "1 Floof: reply “the safer one”"],
    ["for 5 the safer one", "5 Mochi: ? which option"],
    ["for 1 don't go with 2", "1 Floof: ? a Cell can't read option numbers"],
    ["for 12 go with 1", "no card 12"],
    ["5 go with 2 and what's Goose doing?", "5 Mochi: Remove it first · rest: what's Goose doing?"],
    ["2 Sol in Harbor fix the export", "rest: 2 Sol in Harbor fix the export"],
    ["Harbor fix the header", "rest: Harbor fix the header"],
  ])("%s", (text, expected) => {
    expect(preview(text)).toBe(expected);
  });
});

describe("readAnswers: anchors", () => {
  it.each([
    ["#2 wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["number 2: wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["four 2 wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["4 2 wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["the second: wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["tell Bongo to wait", `2 Bongo: ${kindOf(2, "wait")}`],
    ["Otter, wait", `4 Otter: ${kindOf(4, "carryOn")}`],
    // A name holds only when an answer follows; else it's a message to that Cell.
    ["Otter, rebase onto main", "rest: Otter, rebase onto main"],
    ["Floof, use staging", "rest: Floof, use staging"],
    ["1, 2", `1 Floof: ${title(1, 2)}`],
    // Not answers: a count, a pasted list, a number inside a sentence.
    ["2 more tests in Harbor", "rest: 2 more tests in Harbor"],
    ["1. fix the header\n2. fix the footer", "rest: 1. fix the header\n2. fix the footer"],
    ["I asked for 2 things", "rest: I asked for 2 things"],
    ["For 5 minutes, run the soak test", "rest: For 5 minutes, run the soak test"],
    ["for 2 more tests", "rest: for 2 more tests"],
  ])("%s", (text, expected) => {
    expect(preview(text)).toBe(expected);
  });

  it("a list answers each card its own way, but never a permission", () => {
    expect(preview("1, 2 and 3: later")).toBe(
      `1 Floof: ${LATER.title} · 2 Bongo: ${kindOf(2, "wait")} · 3 Pip: ? a permission is answered on its own`,
    );
  });

  it("a card answered twice keeps the second", () => {
    expect(preview("for 2 wait. for 2 reply use staging")).toBe(
      `2 Bongo: ${kindOf(2, "wait")} · 2 Bongo: ? answered already`,
    );
  });

  it("a card already answered keeps the words", () => {
    const cards = CARDS.map((card) => (card.number === 2 ? { ...card, held: true } : card));
    expect(preview("for 2 wait", cards)).toBe("2 Bongo: ? answered already");
  });

  it("a card that left keeps its words", () => {
    const cards = CARDS.map((card) => (card.number === 2 ? { ...card, gone: true } : card));
    expect(preview("for 2 wait", cards)).toBe("2 Bongo: is gone");
  });

  it("two Cells with one name answer by number", () => {
    const cards = [...CARDS.slice(0, 3), { ...CARDS[3]!, name: "Pip", who: "Pip" }];
    expect(preview("Pip, wait", cards)).toBe(
      "3 Pip: ? two Cells are called Pip: use the number · 4 Pip: ? two Cells are called Pip: use the number",
    );
  });
});

describe("readAnswers: answers", () => {
  it.each([
    // A permission: words say no; only a click says yes.
    ["3 approve it", `3 Pip: ${allow(3)} — needs your click`],
    ["3 always allow", `3 Pip: ${title(3, 2)} — needs your click`],
    ["3 decline", `3 Pip: ${decline(3)}`],
    ["for 3 use a normal push", "3 Pip: ? yes or no"],
    // An offer.
    ["6 yes", `6 Gus: ${kindOf(6, "goAhead")}`],
    ["for 6 go ahead", `6 Gus: ${kindOf(6, "goAhead")}`],
    ["6 no", `6 Gus: ${kindOf(6, "nothingToDo")}`],
    ["for 6 go ahead but skip the docs", "6 Gus: reply “go ahead but skip the docs”"],
    ["for 6 no, just commit", "6 Gus: reply “no, just commit”"],
    [
      "6 go ahead and what's Goose doing?",
      `6 Gus: ${kindOf(6, "goAhead")} · rest: what's Goose doing?`,
    ],
    // A prose question takes words as said.
    ["for 1 yes", "1 Floof: reply “yes”"],
    ["for 1 nothing", `1 Floof: ${kindOf(1, "nothingToDo")}`],
    ["for 1 wait for the tests to finish", "1 Floof: reply “wait for the tests to finish”"],
    ["1 reply", `1 Floof: ${kindOf(1, "reply")} — say what`],
    ['for 1 "staging. Then run it"', "1 Floof: reply “staging. Then run it”"],
    [
      "for 1 reply use staging. What's Goose doing?",
      "1 Floof: reply “use staging.” · rest: What's Goose doing?",
    ],
    // A stuck run.
    ["2 nudge keep going", "2 Bongo: nudge “keep going”"],
    ["2 stop and reply use staging", "2 Bongo: stop, then reply “use staging”"],
    ["2 stop", `2 Bongo: ${kindOf(2, "stopAndReply")} — say what`],
    // A structured question.
    ["5 go with the second one", "5 Mochi: Remove it first"],
    ["5 option 3", "5 Mochi: ? no option 3"],
    ["5 answer keep both", "5 Mochi: “keep both”"],
    // A plan.
    ["7 yes", `7 Kiwi: ${kindOf(7, "build")}`],
    [
      "for 7 refine add tests first",
      `7 Kiwi: ${kindOf(7, "revise").replace(/…$/, "")}, with “add tests first”`,
    ],
    ["7 no", `7 Kiwi: ${kindOf(7, "revise")} — say what`],
    // A failed run.
    ["8 retry", `8 Taco: ${kindOf(8, "retry")}`],
    ["8 dismiss", `8 Taco: ${kindOf(8, "dismiss")}`],
    // A limit.
    ["4 later", `4 Otter: ${LATER.title}`],
    ["4 carry on", `4 Otter: ${kindOf(4, "carryOn")}`],
    // Sign-in: its chat.
    ["9 open", "9 Yeti: open its chat"],
    ["for 9 yes", "9 Yeti: ? open its chat"],
  ])("%s", (text, expected) => {
    expect(preview(text)).toBe(expected);
  });
});

describe("readAnswers: the spans", () => {
  it("leaves the rest to Aski, and marks where each part's anchor is", () => {
    const text = "What's up? for 2 wait, and 3 no";
    const { parts, rest } = readAnswers(text, CARDS);
    expect(parts.map((part) => text.slice(part.anchor.start, part.anchor.end))).toEqual([
      "for 2",
      "3",
    ]);
    expect(parts.map((part) => text.slice(part.start, part.end))).toEqual(["for 2 wait", "3 no"]);
    expect(rest.map((span) => text.slice(span.start, span.end))).toEqual(["What's up?"]);
  });

  it("reads nothing when no card is open", () => {
    expect(readAnswers("for 1 go with 2", [])).toEqual({
      parts: [],
      spans: [],
      rest: [{ start: 0, end: 15 }],
    });
  });
});

describe("enterOf: what Enter does", () => {
  const enter = (text: string) => {
    const result = enterOf(readAnswers(text, CARDS))!;
    const words = (spans: ReadonlyArray<{ start: number; end: number }>) =>
      spans.map((span) => text.slice(span.start, span.end));
    return {
      answers: result.answers.map(({ number, reading }) => `${number} ${reading.kind}`),
      opens: result.opens,
      clicks: result.clicks.map(({ number, option }) => `${number} ${option.title}`),
      keep: words(result.keep),
      rest: words(result.rest),
    };
  };

  it("holds the answers, lights the clicks, keeps what answered nothing, and sends the rest to Aski", () => {
    expect(
      enter("for 2 wait, 3 yes, for 1 don't go with 2, 9 open. And what's Goose doing?"),
    ).toEqual({
      answers: ["2 option"],
      opens: [9],
      clicks: [`3 ${allow(3)}`],
      keep: ["for 1 don't go with 2"],
      rest: ["what's Goose doing?"],
    });
  });

  it("does nothing when no card is answered", () => {
    expect(enterOf(readAnswers("what's Goose doing?", CARDS))).toBeNull();
  });
});
