import { describe, expect, it } from "vite-plus/test";

import { needFixture, proseFixture, requestFixture } from "./fixtures";
import { askPassagesIn, askPlaceOf, chatAskOf } from "./inChat";

const reply = (id: string, text: string) => ({ id, role: "assistant", text });

describe("a chat ends on its own Cell's ask", () => {
  it("takes the Cell's oldest ask, leaving what upstream's panels answer and other Cells'", () => {
    const list = {
      needs: [
        needFixture({ key: "a", number: 1, request: requestFixture() }),
        needFixture({ key: "b", number: 3, kind: "prose", prose: proseFixture("offer", "Go on?") }),
        needFixture({ key: "c", number: 2, kind: "failed" }),
        needFixture({ key: "d", number: 0, kind: "failed", threadId: "thread-other" }),
        needFixture({ key: "e", number: 0, kind: "limit" }),
      ],
    };
    expect(chatAskOf(list, "thread-floof")?.key).toBe("c");
    expect(chatAskOf({ needs: [list.needs[0]!] }, "thread-floof")).toBeNull();
  });
});

describe("the words an ask was built from", () => {
  const closeOut =
    "Built the store page. Sign in to the store is on the list.\n\n**Left:**\n- you: Sign in to the store\n- you: Approve the `beta` build\n- me: Publish the page · Tell the team";
  const left = needFixture({
    kind: "prose",
    prose: proseFixture("left", "Sign in to the store · Approve the `beta` build", {
      steps: ["Sign in to the store", "Approve the `beta` build"],
      next: "Publish the page · Tell the team",
    }),
  });
  const words = (need: typeof left, text: string) =>
    askPassagesIn(need, text).map(({ kind, index, start, end }) => [
      kind,
      index,
      text.slice(start, end),
    ]);

  it.each([
    [
      "a close-out's steps, the person's stronger than the Cell's own, each its last place",
      left,
      closeOut,
      [
        ["you", 0, "Sign in to the store"],
        ["you", 1, "Approve the `beta` build"],
        ["next", 0, "Publish the page"],
        ["next", 1, "Tell the team"],
      ],
    ],
    [
      "a question's asking sentence, not its context",
      needFixture({
        kind: "prose",
        prose: proseFixture("question", "Both build. Should I ship the dark theme too?"),
      }),
      "Done.\n\nBoth build. Should I ship the dark theme too?",
      [["ask", 0, "Should I ship the dark theme too?"]],
    ],
    [
      "a stop's whole paragraph, which no sentence of its own asks",
      needFixture({ kind: "prose", prose: proseFixture("stopped", "Halfway there.") }),
      "Ran it.\n\nHalfway there.",
      [["ask", 0, "Halfway there."]],
    ],
    [
      "only the steps the reply still holds",
      left,
      "- you: Sign in to the store",
      [["you", 0, "Sign in to the store"]],
    ],
    ["nothing of a failure", needFixture({ kind: "failed" }), "It broke.", []],
  ])("%s", (_, need, text, expected) => {
    expect(words(need, text)).toEqual(expected);
  });

  it("finds them in the latest reply that holds them, else points at the last reply whole", () => {
    const messages = [
      reply("m1", closeOut),
      { id: "u1", role: "user", text: "ok" },
      reply("m2", "Something else"),
      reply("m3", "  "),
    ];
    expect(askPlaceOf(left, messages)?.messageId).toBe("m1");
    expect(askPlaceOf(left, messages.slice(2))).toEqual({ messageId: "m2", passages: [] });
    expect(askPlaceOf(needFixture({ kind: "failed" }), messages)).toEqual({
      messageId: "m2",
      passages: [],
    });
    expect(askPlaceOf(left, [])).toBeNull();
  });
});
