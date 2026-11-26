import { describe, expect, it } from "vite-plus/test";

import { needFixture, proseFixture, requestFixture } from "./fixtures";
import { askAnchorOf, chatAskOf } from "./inChat";

const reply = (id: string, text: string) => ({ id, role: "assistant", text });

describe("a chat docks its own Cell's ask", () => {
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

describe("an ask points at the words it quotes", () => {
  const need = needFixture({
    kind: "prose",
    prose: proseFixture("left", "Sign in to the store. Then merge.", {
      steps: ["Sign in to the store", "Then merge"],
    }),
  });

  it("finds the quoted words in the latest reply that has them", () => {
    const messages = [
      reply("m1", "Done.\n\nSign in to the store. Then merge."),
      { id: "u1", role: "user", text: "ok" },
      reply("m2", "Built it.\n\nShould I go on?"),
    ];
    const ask = needFixture({ kind: "prose", prose: proseFixture("offer", "Should I go on?") });
    expect(askAnchorOf(ask, messages)).toEqual({ messageId: "m2", start: 11, end: 26 });
    expect(askAnchorOf(need, messages)).toEqual({ messageId: "m1", start: 7, end: 40 });
  });

  it("falls back to a step, then to the last reply whole", () => {
    expect(askAnchorOf(need, [reply("m1", "- Sign in to the store\n- Then merge")])).toEqual({
      messageId: "m1",
      start: 2,
      end: 22,
    });
    expect(askAnchorOf(need, [reply("m1", "Something else"), reply("m2", "  ")])).toEqual({
      messageId: "m1",
      start: null,
      end: null,
    });
    expect(askAnchorOf(needFixture({ kind: "failed" }), [reply("m1", "x")])?.messageId).toBe("m1");
  });
});
