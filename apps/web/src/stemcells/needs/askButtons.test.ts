import { describe, expect, it } from "vite-plus/test";

import { cardOf } from "./card";
import { askButtonsOf } from "./askButtons";
import { needFixture, NOW, proseFixture } from "./fixtures";

const buttonsOf = (need: ReturnType<typeof needFixture>) => {
  const buttons = askButtonsOf(cardOf(need, NOW));
  return {
    primary: buttons.primary?.title ?? null,
    rest: buttons.rest.map((option) => option.title),
    notNow: buttons.notNow?.choice.kind ?? null,
  };
};

describe("the ask's buttons", () => {
  it("leave words to the composer, and the first never settles the Cell", () => {
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
