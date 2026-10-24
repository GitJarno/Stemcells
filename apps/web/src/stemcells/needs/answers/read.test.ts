import { type Node as PmNode, Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import { describe, expect, it } from "vite-plus/test";

import { docText } from "../../words/docText";
import { cardOf, LATER } from "../card";
import type { Shown } from "../display";
import { NOW, needFixture, requestFixture } from "../fixtures";
import type { Need } from "../wire";
import { optionCompletionAt } from "./complete";
import { enterOf } from "./enter";
import { giveBack, type Spoken, spokenOf } from "./giveBack";
import { partLines } from "./line";
import { readDoc } from "./plugin";
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

/** The doc's four cards, and one of each other kind, with who each is for. */
const NEEDS: ReadonlyArray<readonly [Need, string]> = [
  [
    needFixture({
      key: "thread-floof:prose:run-1",
      number: 1,
      kind: "prose",
      threadId: "thread-floof",
      prose: { runId: "run-1", cue: "question", text: "Staging, or a fresh local copy?" },
    }),
    "Floof",
  ],
  [
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
  ],
  [needFixture({ number: 3, threadId: "thread-pip", request: requestFixture() }), "Pip"],
  [
    needFixture({
      key: "thread-otter:limit:run-4",
      number: 4,
      kind: "limit",
      threadId: "thread-otter",
      limit: { runId: "run-4", resetAt: "2026-10-21T15:00:00.000Z", autoResume: false },
    }),
    "Otter",
  ],
  [
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
  ],
  [
    needFixture({
      key: "thread-gus:prose:run-6",
      number: 6,
      kind: "prose",
      threadId: "thread-gus",
      prose: { runId: "run-6", cue: "offer", text: "Want me to update the docs too?" },
    }),
    "Gus",
  ],
  [
    needFixture({
      key: "thread-kiwi:plan:run-7",
      number: 7,
      kind: "plan",
      threadId: "thread-kiwi",
      plan: { id: "plan-7", runId: "run-7", title: "Tokens", steps: [], markdown: "# Tokens" },
    }),
    "Kiwi",
  ],
  [
    needFixture({
      key: "thread-taco:failed:run-8",
      number: 8,
      kind: "failed",
      threadId: "thread-taco",
      failure: { runId: "run-8", errorClass: "transport_error", message: "socket hang up" },
    }),
    "Taco",
  ],
  [
    needFixture({
      number: 9,
      kind: "sign-in",
      threadId: "thread-yeti",
      request: requestFixture({ id: "auth-9", kind: "auth_refresh", prompt: null }),
    }),
    "Yeti",
  ],
];
const CARDS: Addressee[] = NEEDS.map(([need, who]) => addressee(need, who));

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

/** The doc's examples, each with the readout it reads as. */
const DOC_EXAMPLES: Array<[string, string]> = [
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
  ["3 yes", `3 Pip: ${allow(3)} (needs your click)`],
  ["3 no, use a normal push", "3 Pip: Decline, with “use a normal push”"],
  ["3 no", `3 Pip: ${decline(3)}`],
  ["for 3 go with 2", `3 Pip: ${title(3, 2)} (needs your click)`],
  ["for 2 go with 1", `2 Bongo: ${title(2, 1)} (say what)`],
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
];

/** How words name a card. */
const ANCHORS: Array<[string, string]> = [
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
  // A bare number before the start of one of its card's titles.
  ["5 remove it first", "5 Mochi: Remove it first"],
  // Not answers: a count, a pasted list, a number inside a sentence.
  ["2 more tests in Harbor", "rest: 2 more tests in Harbor"],
  ["1. fix the header\n2. fix the footer", "rest: 1. fix the header\n2. fix the footer"],
  ["I asked for 2 things", "rest: I asked for 2 things"],
  ["For 5 minutes, run the soak test", "rest: For 5 minutes, run the soak test"],
  ["for 2 more tests", "rest: for 2 more tests"],
];

/** What words answer, card by card. */
const ANSWERS: Array<[string, string]> = [
  // A permission: words say no; only a click says yes.
  ["3 approve it", `3 Pip: ${allow(3)} (needs your click)`],
  ["3 always allow", `3 Pip: ${title(3, 2)} (needs your click)`],
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
  ["1 reply", `1 Floof: ${kindOf(1, "reply")} (say what)`],
  ['for 1 "staging. Then run it"', "1 Floof: reply “staging. Then run it”"],
  [
    "for 1 reply use staging. What's Goose doing?",
    "1 Floof: reply “use staging.” · rest: What's Goose doing?",
  ],
  // A stuck run.
  ["2 nudge keep going", "2 Bongo: nudge “keep going”"],
  ["2 stop and reply use staging", "2 Bongo: stop, then reply “use staging”"],
  ["2 stop", `2 Bongo: ${kindOf(2, "stopAndReply")} (say what)`],
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
  ["7 no", `7 Kiwi: ${kindOf(7, "revise")} (say what)`],
  // A failed run.
  ["8 retry", `8 Taco: ${kindOf(8, "retry")}`],
  ["8 dismiss", `8 Taco: ${kindOf(8, "dismiss")}`],
  // A limit.
  ["4 later", `4 Otter: ${LATER.title}`],
  ["4 carry on", `4 Otter: ${kindOf(4, "carryOn")}`],
  // Sign-in: its chat.
  ["9 open", "9 Yeti: open its chat"],
  ["for 9 yes", "9 Yeti: ? open its chat"],
];

/** Words that take every other card's recommendation: Kiwi's plan and Taco's retry. */
const THE_REST: Array<[string, string]> = [
  ["ok the rest", `7 Kiwi: ${kindOf(7, "build")} · 8 Taco: ${kindOf(8, "retry")}`],
  ["ok", `7 Kiwi: ${kindOf(7, "build")} · 8 Taco: ${kindOf(8, "retry")}`],
  ["Yes to all.", `7 Kiwi: ${kindOf(7, "build")} · 8 Taco: ${kindOf(8, "retry")}`],
  ["go with your recommendations", `7 Kiwi: ${kindOf(7, "build")} · 8 Taco: ${kindOf(8, "retry")}`],
  ["8 dismiss, ok the rest", `8 Taco: ${kindOf(8, "dismiss")} · 7 Kiwi: ${kindOf(7, "build")}`],
  // A reply stops where the rest begins.
  [
    "7 refine add tests first, and the rest ok",
    `7 Kiwi: ${kindOf(7, "revise").replace(/…$/, "")}, with “add tests first” · 8 Taco: ${kindOf(8, "retry")}`,
  ],
  // Only at the end, and only as said.
  ["ok, 5 go with 2", "5 Mochi: Remove it first · rest: ok"],
  ["ok thanks", "rest: ok thanks"],
  ["is the rest ok?", "rest: is the rest ok?"],
];

describe("readAnswers: the rest", () => {
  it.each(THE_REST)("%s", (text, expected) => {
    expect(preview(text)).toBe(expected);
  });

  it("skips a card answered already or gone", () => {
    const cards = CARDS.map((card) =>
      card.number === 7
        ? { ...card, held: true }
        : card.number === 8
          ? { ...card, gone: true }
          : card,
    );
    expect(preview("ok the rest", [...cards, addressee(NEEDS[7]![0], "Taco")])).toBe(
      `8 Taco: ${kindOf(8, "retry")}`,
    );
  });

  it("leaves the words to Aski when no card recommends anything", () => {
    expect(preview("ok the rest", CARDS.slice(0, 6))).toBe("rest: ok the rest");
  });

  it("answers a question with its recommended option, and a Cell that stopped short with go ahead", () => {
    const question = needFixture({
      key: "thread-mochi:request:question-2",
      number: 1,
      kind: "question",
      threadId: "thread-mochi",
      request: requestFixture({
        id: "question-2",
        kind: "user_input",
        prompt: null,
        questions: [
          {
            id: "where",
            header: "Where",
            question: "Staging, or a fresh local copy?",
            options: [
              { label: "Fresh local copy", description: "", value: null },
              { label: "Staging (Recommended)", description: "", value: null },
            ],
            multiSelect: false,
            allowCustomAnswer: true,
          },
        ],
      }),
    });
    const stopped = needFixture({
      key: "thread-gus:prose:run-2",
      number: 2,
      kind: "prose",
      threadId: "thread-gus",
      prose: { runId: "run-2", cue: "stopped", text: "Tests pass; the docs are left." },
    });
    expect(preview("ok", [addressee(question, "Mochi"), addressee(stopped, "Gus")])).toBe(
      "1 Mochi: Staging · 2 Gus: Go ahead",
    );
  });
});

/** What Tab writes at the end of the words, if anything. */
const tab = (text: string, cards: ReadonlyArray<Addressee> = CARDS) =>
  optionCompletionAt(text, text.length, cards)?.rest ?? null;

describe("optionCompletionAt: Tab completes an option", () => {
  it("offers the recommendation once the card is named", () => {
    expect(tab("8 ")).toBe(kindOf(8, "retry"));
    expect(tab("for 7 ")).toBe(kindOf(7, "build"));
    expect(tab("3 no, and 8 ")).toBe(kindOf(8, "retry"));
    // Pip recommends nothing.
    expect(tab("3 ")).toBeNull();
  });

  it("completes the option that starts with what's typed, as the reader reads it back", () => {
    expect(tab("3 alw")).toBe(title(3, 2).slice(3));
    expect(tab("5 rem")).toBe("ove it first");
    expect(tab("for 5 Comm")).toBe("it, then remove");
    expect(tab("2 st")).toBe("op and reply");
    expect(tab("4 la")).toBe("ter");
  });

  it("offers nothing that wouldn't answer the card", () => {
    expect(tab("8 retry")).toBeNull();
    expect(tab("2 Sol")).toBeNull();
    expect(tab("I asked for 2 ")).toBeNull();
    expect(tab("12 ")).toBeNull();
    expect(optionCompletionAt("8 Re", 3, CARDS)).toBeNull();
    const held = CARDS.map((card) => (card.number === 8 ? { ...card, held: true } : card));
    expect(tab("8 ", held)).toBeNull();
  });

  it("asks for words after an option that takes them", () => {
    expect(optionCompletionAt("2 st", 4, CARDS)?.words).toBe(true);
    expect(optionCompletionAt("8 ", 2, CARDS)?.words).toBe(false);
  });
});

describe("readAnswers: the doc's examples", () => {
  it.each(DOC_EXAMPLES)("%s", (text, expected) => {
    expect(preview(text)).toBe(expected);
  });
});

describe("readAnswers: anchors", () => {
  it.each(ANCHORS)("%s", (text, expected) => {
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
  it.each(ANSWERS)("%s", (text, expected) => {
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
    const result = enterOf(readAnswers(text, CARDS), text)!;
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

  it("keeps the words that said each answer, past what named its card, a list's per card", () => {
    const said = (text: string) =>
      enterOf(readAnswers(text, CARDS), text)!.answers.map(({ said }) =>
        text.slice(said.start, said.end),
      );
    expect(said("1 and 2 later. for 4 wait")).toEqual(["later", "later", "wait"]);
    expect(said("Otter, later. for 1: reply use staging")).toEqual(["later", "reply use staging"]);
    // Otter takes no words, so its answer ends where Floof's reply runs on.
    expect(said("1 and 4 later today")).toEqual(["later today", "later"]);
  });

  it("does nothing when no card is answered", () => {
    expect(enterOf(readAnswers("what's Goose doing?", CARDS), "what's Goose doing?")).toBeNull();
  });
});

/** The composer's shape, as far as giving back cares: lines, chips, code and line breaks. */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true },
    "composer-mention": {
      group: "inline",
      inline: true,
      atom: true,
      attrs: { path: { default: "" }, source: { default: "" } },
    },
  },
  marks: { code: { code: true } },
});
const line = (...content: Array<string | PmNode>) =>
  schema.node(
    "paragraph",
    null,
    content.map((each) => (typeof each === "string" ? schema.text(each) : each)),
  );
const code = (text: string) => schema.text(text, [schema.mark("code")]);
const BREAK = schema.node("hardBreak");
const composer = (...lines: PmNode[]) =>
  EditorState.create({
    schema,
    doc: schema.node("doc", null, lines.length > 0 ? lines : [line()]),
  });
const textOf = (state: EditorState) => docText(state.doc).text;

/** The page's live list, as the cards above. */
const HERE: Shown[] = NEEDS.map(([need]) => ({ need, goneAt: null }));

/** What Enter keeps of the composer's words, an answer each, read as the composer reads them. */
function said(state: EditorState, cards: ReadonlyArray<Addressee> = CARDS): Spoken[] {
  const { text, answers } = readDoc(state.doc, cards);
  const enter = enterOf(answers, text.raw);
  return (enter?.answers ?? []).flatMap((answer) => {
    const [need, who] = NEEDS.find(([each]) => each.number === answer.number)!;
    const spoken = spokenOf(state.doc, text, answer, { key: need.key, who });
    return spoken === null ? [] : [spoken];
  });
}
const answersIn = (state: EditorState) =>
  said(state).map(({ number, chose }) => `${number} ${chose}`);

/** The composer once these words come back to it, one after another. */
const back = (
  state: EditorState,
  words: ReadonlyArray<Spoken>,
  here: ReadonlyArray<Shown> = HERE,
  cards: ReadonlyArray<Addressee> = CARDS,
) => words.reduce((each, spoken) => each.apply(giveBack(each, spoken, here, cards)), state);

/** Answers that ran into each other when they came back a space apart. */
const RUN_TOGETHER = [
  "1 and 2 later",
  "6 yes, 1 reply check the logs",
  "for 1 reply check the logs. 6 yes",
  "1 and 4 later today",
  "5 answer keep both, 2 nudge keep going",
];
/** What the composer may hold when words come back: nothing, or a draft half typed. */
const DRAFTS: ReadonlyArray<ReadonlyArray<PmNode>> = [
  [],
  [line("what's Goo")],
  [line("what's", BREAK, "Goose")],
  [line("I asked for 2")],
  [line("1. fix the header"), line("2. fix the")],
];

describe("giving back: the words read as the same answer again", () => {
  const shapes = [...DOC_EXAMPLES, ...ANCHORS, ...ANSWERS].map(([text]) => text);

  it.each([...shapes, ...RUN_TOGETHER])("%s", (text) => {
    const words = said(composer(line(text)));
    const answers = words.map(({ number, chose }) => `${number} ${chose}`);
    for (const draft of DRAFTS) {
      const before = composer(...draft);
      const own = answersIn(before);
      for (const one of words) {
        const after = back(before, [one]);
        expect(textOf(after).split("\n").at(-1)).toMatch(new RegExp(`^for ${one.number} `));
        expect(answersIn(after)).toEqual([...own, `${one.number} ${one.chose}`]);
      }
      expect(answersIn(back(before, words))).toEqual([...own, ...answers]);
      expect(answersIn(back(before, words.toReversed()))).toEqual([
        ...own,
        ...answers.toReversed(),
      ]);
    }
  });

  it("comes back a line each, never run together", () => {
    expect(textOf(back(composer(), said(composer(line("1 and 2 later")))))).toBe(
      "for 1 later\nfor 2 later",
    );
    expect(
      textOf(
        back(composer(line("what's Goo")), said(composer(line("6 yes, 1 reply check the logs")))),
      ),
    ).toBe("what's Goo\nfor 6 yes\nfor 1 reply check the logs");
  });

  it("gives back a chip as the chip, and code as code", () => {
    const chip = schema.node("composer-mention", { path: "src/App.tsx", source: "@src/App.tsx" });
    const words = said(composer(line("1 reply run ", code("pnpm test"), " in ", chip, " now")));
    // The reply it re-checks is the one the Cell would be sent.
    expect(words.map(({ chose }) => chose)).toEqual([
      "option reply run `pnpm test` in @src/App.tsx now",
    ]);
    const after = back(composer(), words);
    expect(after.doc.lastChild!.toJSON()).toEqual(
      line("for 1 reply run ", code("pnpm test"), " in ", chip, " now").toJSON(),
    );
    expect(answersIn(after)).toEqual(words.map(({ number, chose }) => `${number} ${chose}`));
  });

  it("gives back a line break inside an answer as a line break", () => {
    const words = said(composer(line("1 reply run ```pnpm", BREAK, "test``` now")));
    expect(words).toHaveLength(1);
    const after = back(composer(), words);
    expect(after.doc.lastChild!.toJSON()).toEqual(
      line("for 1 reply run ```pnpm", BREAK, "test``` now").toJSON(),
    );
    expect(answersIn(after)).toEqual(words.map(({ number, chose }) => `${number} ${chose}`));
  });
});

describe("giving back: the rest", () => {
  it("holds every recommendation, and gives back only the words that said one", () => {
    const state = composer(line("8 dismiss, ok the rest"));
    const { text, answers } = readDoc(state.doc, CARDS);
    expect(enterOf(answers, text.raw)!.answers.map(({ number }) => number)).toEqual([8, 7]);
    expect(said(state).map(({ number }) => number)).toEqual([8]);
  });
});

describe("giving back: the words never reach another Cell", () => {
  const otter = needFixture({
    key: "thread-otter:request:request-9",
    number: 3,
    threadId: "thread-otter",
    request: requestFixture({ id: "request-9" }),
  });
  const pip = HERE.find(({ need }) => need.number === 3)!.need;

  it("a number given to another Cell never receives the given-back answer", () => {
    // The list emptied and filled again: 3 is Otter's now.
    const cards = [addressee(otter, "Otter")];
    const after = back(
      composer(),
      said(composer(line("3 no"))),
      [{ need: otter, goneAt: null }],
      cards,
    );
    expect(textOf(after)).toBe("Pip › no");
    expect(readAnswers(textOf(after), cards).parts).toEqual([]);
  });

  it("a card that left gives its words back without its number, though no other has it yet", () => {
    const cards = [addressee(pip, "Pip", true)];
    const after = back(
      composer(),
      said(composer(line("3 no"))),
      [{ need: pip, goneAt: NOW }],
      cards,
    );
    expect(textOf(after)).toBe("Pip › no");
    expect(readAnswers(textOf(after), cards).parts).toEqual([]);
  });

  it("words that wouldn't read as the same answer come back without the number", () => {
    // A list takes "more", which after one number says how many.
    const after = back(composer(), said(composer(line("1 and 2: more tests please"))).slice(0, 1));
    expect(textOf(after)).toBe("Floof › more tests please");
    expect(readAnswers(textOf(after), CARDS).parts).toEqual([]);
  });

  it("a subagent's words come back after the Cell it works for", () => {
    const helper = needFixture({
      key: "thread-scout:request:request-4",
      number: 4,
      threadId: "thread-scout",
      parentThreadId: "thread-floof",
      request: requestFixture({ id: "request-4" }),
    });
    const text = docText(composer(line("4 no")).doc);
    const cards = [addressee(helper, "Floof › Header tokens")];
    const [answer] = enterOf(readAnswers(text.text, cards), text.raw)!.answers;
    const spoken = spokenOf(composer(line("4 no")).doc, text, answer!, {
      key: helper.key,
      who: "Floof › Header tokens",
    });
    const after = back(composer(), [spoken!], [], []);
    expect(textOf(after)).toBe("Floof › Header tokens › no");
  });
});
