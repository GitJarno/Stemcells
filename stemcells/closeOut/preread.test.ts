import { describe, expect, it } from "vite-plus/test";

import { QUOTE_CAP, lastParagraph, preRead } from "./preread.ts";

const cueOf = (reply: string) => preRead(reply)?.cue ?? null;

describe("the pre-read of a finished reply", () => {
  it("finds a question in the last paragraph", () => {
    expect(cueOf("Tests pass.\n\nShould the migration run on staging or a fresh local copy?")).toBe(
      "question",
    );
    expect(cueOf("Done with the header.\n\nWhich colour do you want for the edge?")).toBe(
      "question",
    );
  });

  it("reads an ask a yes answers as an offer", () => {
    expect(cueOf("The fix is in.\n\nWant me to push it?")).toBe("offer");
    expect(cueOf("Shall I open the PR? Should I also bump the version?")).toBe("offer");
    expect(cueOf("Let me know if you'd like me to update the docs too.")).toBe("offer");
  });

  it("keeps an either-or ask a question, which Go ahead can't answer", () => {
    expect(cueOf("Should I keep the old route or remove it?")).toBe("question");
  });

  it("reads a stop short of done", () => {
    expect(cueOf("Wired the stream.\n\nNext, I'll add the cards.")).toBe("stopped");
    expect(cueOf("3 of 8 done: the rest need the new schema.")).toBe("stopped");
  });

  it("calls a reply that asks nothing a report", () => {
    expect(cueOf("Fixed the flaky test and pushed. CI is green.")).toBeNull();
    expect(cueOf("")).toBeNull();
  });

  it("doesn't take a report's closing courtesy for an ask", () => {
    expect(cueOf("All done; the PR is open.\n\nLet me know if you have any questions.")).toBeNull();
    expect(cueOf("Merged.\nLet me know if anything else comes up.")).toBeNull();
  });

  it("doesn't take a question mark in code or a link for an ask", () => {
    expect(cueOf("The guard is `user?.name`, and the docs are at https://example.com/a?b=1.")).toBe(
      null,
    );
    expect(cueOf("Added it:\n\n```ts\nconst ok = a ?? b;\nif (x?) {}\n```\n\nTests pass.")).toBe(
      null,
    );
  });

  it("asks only what the last paragraph asks", () => {
    expect(cueOf("Should I start?\n\nI went ahead and started. It's merged now.")).toBeNull();
  });
});

describe("the paragraph a card quotes", () => {
  it("is the last paragraph, word for word", () => {
    expect(preRead("I fixed it.\n\nWant me to **push** it?")?.text).toBe("Want me to **push** it?");
  });

  it("keeps the choices that end the reply with the question that leads into them", () => {
    const reply = "Two ways:\n\nWhich do you want?\n\n1. Keep the route\n2. Remove it";
    expect(lastParagraph(reply)).toBe("Which do you want?\n\n1. Keep the route\n2. Remove it");
    expect(cueOf(reply)).toBe("question");
  });

  it("keeps the end of a long paragraph, from a word's start", () => {
    const text = preRead(`${"word ".repeat(400)}Want me to go on?`)?.text ?? "";
    expect(text.startsWith("…word")).toBe(true);
    expect(text.endsWith("Want me to go on?")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(QUOTE_CAP + 1);
  });
});
