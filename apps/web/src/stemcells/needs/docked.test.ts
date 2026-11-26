import { describe, expect, it } from "vite-plus/test";

import { cardOf } from "./card";
import { dockedButtonsOf, dockedKeysFree } from "./docked";
import { needFixture, NOW, proseFixture } from "./fixtures";

const buttonsOf = (need: ReturnType<typeof needFixture>) => {
  const buttons = dockedButtonsOf(cardOf(need, NOW));
  return {
    primary: buttons.primary?.title ?? null,
    rest: buttons.rest.map((option) => option.title),
    notNow: buttons.notNow?.choice.kind ?? null,
  };
};

describe("the docked ask's buttons", () => {
  it("leave words to the composer, and Return never settles the Cell", () => {
    expect(
      buttonsOf(needFixture({ kind: "prose", prose: proseFixture("question", "Which one?") })),
    ).toEqual({ primary: null, rest: ["Nothing to do"], notNow: "later" });
    expect(
      buttonsOf(needFixture({ kind: "prose", prose: proseFixture("offer", "Shall I go on?") })),
    ).toEqual({ primary: "Go ahead", rest: ["Nothing to do"], notNow: "later" });
  });

  it("offer Not now only where the card has a Later", () => {
    expect(buttonsOf(needFixture({ kind: "stuck" }))).toEqual({
      primary: "Wait 15 min",
      rest: [],
      notNow: null,
    });
  });
});

describe("the composer's keys", () => {
  it("stay upstream's while its own panel asks in the same chat", () => {
    const failed = needFixture({ key: "f", kind: "failed" });
    const question = needFixture({ key: "q", kind: "question" });
    expect(dockedKeysFree({ needs: [failed] }, "thread-floof")).toBe(true);
    expect(dockedKeysFree({ needs: [failed, question] }, "thread-floof")).toBe(false);
    expect(dockedKeysFree({ needs: [question] }, "thread-other")).toBe(true);
  });
});
